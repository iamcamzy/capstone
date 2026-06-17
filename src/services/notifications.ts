import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import {
  BOOKING_STATUS_LABELS,
  type BookingStatus,
  type NotifiableBookingStatus,
  isNotifiableBookingStatus,
  normalizeBookingStatus,
} from "../lib/bookingStatus";
import { supabaseAdmin, supabase } from "../lib/supabase";
import { sendTransactionalEmail, type EmailSendResult } from "./email";
import { sendSmsNotification } from "./sms";

type DbClient = SupabaseClient<Database>;

type NotificationBooking = {
  id: string;
  userId: string;
  status: BookingStatus;
  fullName: string;
  phone: string;
  eventDate: string;
  startDate: string;
  endDate: string;
  packageName: string;
  venueName: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
};

type NotificationResult = {
  email?: EmailSendResult;
  sms?: Awaited<ReturnType<typeof sendSmsNotification>>;
};

export type BookingStatusUpdateResult = {
  booking: { id: string; status: BookingStatus };
  notification?: NotificationResult;
  warning?: string;
};

const db = supabaseAdmin ?? supabase;

const STATUS_MESSAGES: Record<NotifiableBookingStatus, string> = {
  contract_signing:
    "Your booking is ready for contract signing. Please coordinate with the resort team for the next steps.",
  booked: "Your booking has been officially booked.",
  rescheduled: "Your booking has been rescheduled. Please review the updated event details.",
  cancelled: "Your booking has been cancelled.",
  completed: "Thank you for choosing us. Your event has been marked completed.",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "No event date provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No event date provided";
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailContent(
  booking: NotificationBooking,
  status: NotifiableBookingStatus | "reminder",
): { subject: string; textContent: string; htmlContent: string } {
  const label = status === "reminder" ? "1-Week Reminder" : BOOKING_STATUS_LABELS[status];
  const statusLine =
    status === "reminder"
      ? "Your event is scheduled one week from now."
      : `Your booking status has been updated to: ${label}.`;
  const statusMessage =
    status === "reminder"
      ? "Your event is scheduled one week from now. Please coordinate any remaining details with Woodberry Resorts and Events Place."
      : STATUS_MESSAGES[status];

  const lines = [
    `Hello ${booking.fullName},`,
    "",
    statusLine,
    "",
    "Booking Details:",
    `Venue: ${booking.venueName}`,
    `Event Date: ${formatDate(booking.eventDate)}`,
    `Package: ${booking.packageName}`,
    `Reference ID: ${booking.id}`,
    "",
    statusMessage,
    "",
    "For questions or concerns, please contact Woodberry Resorts and Events Place.",
    "",
    "Thank you,",
    "Woodberry Resorts and Events Place",
  ];

  const htmlLines = lines.map((line) => (line ? escapeHtml(line) : ""));

  return {
    subject: `Booking Update: ${label}`,
    textContent: lines.join("\n"),
    htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">${htmlLines
      .map((line) => (line ? `<p>${line}</p>` : "<br>"))
      .join("")}</div>`,
  };
}

async function fetchNotificationBooking(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationBooking | null> {
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select(
      "id, user_id, status, full_name, phone, event_date, start_date, end_date, package_id, venue_id",
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    console.error("[Notifications] Booking fetch failed", bookingError?.message);
    return null;
  }

  const [{ data: customer }, { data: venue }, { data: pkg }] = await Promise.all([
    client
      .from("customers")
      .select("email, first_name, last_name, phone, email_notifications_enabled, sms_notifications_enabled")
      .eq("id", booking.user_id)
      .maybeSingle(),
    client.from("venues").select("name").eq("id", booking.venue_id).maybeSingle(),
    booking.package_id
      ? client.from("packages").select("name").eq("id", booking.package_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const profileName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim();

  return {
    id: booking.id,
    userId: booking.user_id,
    status: normalizeBookingStatus(booking.status),
    fullName: (booking.full_name ?? profileName) || "Client",
    phone: booking.phone ?? customer?.phone ?? "No phone provided",
    eventDate: booking.event_date ?? booking.start_date ?? "No event date provided",
    startDate: booking.start_date,
    endDate: booking.end_date,
    packageName: pkg?.name ?? "No package selected",
    venueName: venue?.name ?? "Unknown venue",
    email: customer?.email ?? null,
    emailNotificationsEnabled: customer?.email_notifications_enabled ?? true,
    smsNotificationsEnabled: customer?.sms_notifications_enabled ?? true,
  };
}

export async function notifyBookingStatusChange(
  bookingId: string,
  status: BookingStatus,
  client: DbClient = db,
): Promise<NotificationResult> {
  if (!isNotifiableBookingStatus(status)) return {};

  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  const result: NotificationResult = {};

  if (!booking.emailNotificationsEnabled) {
    result.email = { ok: true, skipped: true, reason: "Email notifications are disabled for this customer" };
  } else if (!booking.email) {
    result.email = { ok: false, error: "No customer email is saved for this booking" };
  } else {
    const content = buildEmailContent(booking, status);
    result.email = await sendTransactionalEmail({
      toEmail: booking.email,
      toName: booking.fullName,
      ...content,
    });
  }

  if (booking.smsNotificationsEnabled) {
    result.sms = await sendSmsNotification();
  }

  return result;
}

export async function sendOneWeekReminder(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  const result: NotificationResult = {};

  if (!booking.emailNotificationsEnabled) {
    result.email = { ok: true, skipped: true, reason: "Email notifications are disabled for this customer" };
  } else if (!booking.email) {
    result.email = { ok: false, error: "No customer email is saved for this booking" };
  } else {
    const content = buildEmailContent(booking, "reminder");
    result.email = await sendTransactionalEmail({
      toEmail: booking.email,
      toName: booking.fullName,
      ...content,
    });
  }

  if (booking.smsNotificationsEnabled) {
    result.sms = await sendSmsNotification();
  }

  return result;
}

export function notificationSucceeded(result: NotificationResult): boolean {
  return Boolean(result.email && result.email.ok && !result.email.skipped);
}

export async function updateBookingStatusAndNotify(
  bookingId: string,
  newStatus: BookingStatus,
  options: {
    client?: DbClient;
    update?: Record<string, unknown>;
    notify?: boolean;
  } = {},
): Promise<BookingStatusUpdateResult> {
  const client = options.client ?? db;
  const now = new Date().toISOString();
  const normalizedStatus = normalizeBookingStatus(newStatus);

  const statusDates: Record<string, string> = {};
  if (normalizedStatus === "booked") statusDates.confirmed_at = now;
  if (normalizedStatus === "cancelled") statusDates.cancelled_at = now;
  if (normalizedStatus === "rescheduled") statusDates.rescheduled_at = now;

  const { data: booking, error: updateError } = await client
    .from("bookings")
    .update({
      ...(options.update ?? {}),
      ...statusDates,
      status: normalizedStatus,
      status_updated_at: now,
      updated_at: now,
    })
    .eq("id", bookingId)
    .select("id, status")
    .single();

  if (updateError || !booking) {
    throw new Error(updateError?.message ?? "Booking update failed");
  }

  const result: BookingStatusUpdateResult = {
    booking: { id: booking.id, status: normalizeBookingStatus(booking.status) },
  };

  if (options.notify === false || !isNotifiableBookingStatus(normalizedStatus)) {
    return result;
  }

  try {
    result.notification = await notifyBookingStatusChange(bookingId, normalizedStatus, client);
    if (result.notification.email && !result.notification.email.ok) {
      result.warning = result.notification.email.error;
      console.error("[Notifications]", result.notification.email.error);
    } else if (result.notification.email?.skipped) {
      result.warning = result.notification.email.reason;
      console.warn("[Notifications]", result.notification.email.reason);
    }
  } catch (notificationError) {
    const message =
      notificationError instanceof Error ? notificationError.message : "Notification failed";
    result.warning = message;
    console.error("[Notifications]", message);
  }

  return result;
}
