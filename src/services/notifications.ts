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
import { sendSmsNotification, type SmsSendResult } from "./sms";

type DbClient = SupabaseClient<Database>;

type NotificationBooking = {
  id: string;
  userId: string;
  status: BookingStatus;
  fullName: string;
  phone: string | null;
  eventDate: string;
  startDate: string;
  endDate: string;
  contractSigningDate: string | null;
  contractSigningTime: string | null;
  packageName: string;
  venueName: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
};

type NotificationResult = {
  email?: EmailSendResult;
  sms?: SmsSendResult;
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

type BookingNotificationKind = NotifiableBookingStatus | "reminder" | "contract_signing_schedule";

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

function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const [hourValue, minuteValue] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;

  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatContractSigningSchedule(booking: NotificationBooking): string {
  const date = formatDate(booking.contractSigningDate);
  const time = formatTime(booking.contractSigningTime);
  return time ? `${date} at ${time}` : date;
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
  status: BookingNotificationKind,
): { subject: string; textContent: string; htmlContent: string } {
  const isScheduleNotification = status === "contract_signing_schedule";
  const contractSigningSchedule = formatContractSigningSchedule(booking);
  const label =
    status === "reminder"
      ? "1-Week Reminder"
      : isScheduleNotification
        ? "Contract Signing Schedule"
        : BOOKING_STATUS_LABELS[status];
  const statusLine =
    status === "reminder"
      ? "Your event is scheduled one week from now."
      : isScheduleNotification
        ? `Your contract signing is scheduled for ${contractSigningSchedule}.`
        : `Your booking status has been updated to: ${label}.`;
  const statusMessage =
    status === "reminder"
      ? "Your event is scheduled one week from now. Please coordinate any remaining details with Woodberry Resorts and Events Place."
      : isScheduleNotification
        ? `Please visit Woodberry Resorts and Events Place for contract signing on ${contractSigningSchedule}.`
      : STATUS_MESSAGES[status];

  const lines = [
    `Hello ${booking.fullName},`,
    "",
    statusLine,
    "",
    "Booking Details:",
    `Venue: ${booking.venueName}`,
    `Event Date: ${formatDate(booking.eventDate)}`,
    ...(isScheduleNotification ? [`Contract Signing: ${contractSigningSchedule}`] : []),
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
      "id, user_id, status, full_name, phone, event_date, start_date, end_date, contract_signing_date, contract_signing_time, package_id, venue_id",
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
    phone: booking.phone ?? customer?.phone ?? null,
    eventDate: booking.event_date ?? booking.start_date ?? "No event date provided",
    startDate: booking.start_date,
    endDate: booking.end_date,
    contractSigningDate: booking.contract_signing_date,
    contractSigningTime: booking.contract_signing_time,
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

  return sendBookingNotification(booking, status);
}

async function sendBookingNotification(
  booking: NotificationBooking,
  status: BookingNotificationKind,
): Promise<NotificationResult> {
  const content = buildEmailContent(booking, status);
  const result: NotificationResult = {};
  const tasks: Array<{
    channel: "email" | "sms";
    promise: Promise<EmailSendResult | SmsSendResult>;
  }> = [];

  if (!booking.emailNotificationsEnabled) {
    result.email = { ok: true, skipped: true, reason: "Email notifications are disabled for this customer" };
  } else if (!booking.email) {
    result.email = { ok: false, error: "No customer email is saved for this booking" };
  } else {
    tasks.push({
      channel: "email",
      promise: sendTransactionalEmail({
        toEmail: booking.email,
        toName: booking.fullName,
        ...content,
      }),
    });
  }

  if (!booking.smsNotificationsEnabled) {
    result.sms = { ok: true, skipped: true, reason: "SMS notifications are disabled for this customer" };
  } else {
    tasks.push({
      channel: "sms",
      promise: sendSmsNotification({
        to: booking.phone ?? "",
        message: content.textContent,
      }),
    });
  }

  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  settled.forEach((settledResult, index) => {
    const channel = tasks[index].channel;
    const value =
      settledResult.status === "fulfilled"
        ? settledResult.value
        : {
            ok: false as const,
            error:
              settledResult.reason instanceof Error
                ? settledResult.reason.message
                : `${channel.toUpperCase()} notification failed`,
          };

    if (channel === "email") {
      result.email = value as EmailSendResult;
    } else {
      result.sms = value as SmsSendResult;
    }
  });

  return result;
}

function delivered(result: EmailSendResult | SmsSendResult | undefined): boolean {
  return Boolean(result?.ok && (!("skipped" in result) || !result.skipped));
}

function skippedReason(result: EmailSendResult | SmsSendResult | undefined): string | null {
  if (result?.ok && "skipped" in result && result.skipped) return result.reason;
  return null;
}

function notificationWarning(result: NotificationResult): string | undefined {
  const emailFailed = result.email && !result.email.ok ? result.email.error : null;
  const smsFailed = result.sms && !result.sms.ok ? result.sms.error : null;
  if (emailFailed && smsFailed) return `${emailFailed}; ${smsFailed}`;
  if (emailFailed) return emailFailed;
  if (smsFailed) return smsFailed;

  if (delivered(result.email) || delivered(result.sms)) return undefined;

  const emailSkipped = skippedReason(result.email);
  const smsSkipped = skippedReason(result.sms);
  if (emailSkipped && smsSkipped) return `${emailSkipped}; ${smsSkipped}`;
  return emailSkipped ?? smsSkipped ?? undefined;
}

export async function sendOneWeekReminder(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  return sendBookingNotification(booking, "reminder");
}

export async function notifyContractSigningSchedule(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  return sendBookingNotification(booking, "contract_signing_schedule");
}

export function notificationSucceeded(result: NotificationResult): boolean {
  return delivered(result.email) || delivered(result.sms);
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
    const warning = notificationWarning(result.notification);
    if (warning) {
      result.warning = warning;
      console.warn("[Notifications]", warning);
    }
  } catch (notificationError) {
    const message =
      notificationError instanceof Error ? notificationError.message : "Notification failed";
    result.warning = message;
    console.error("[Notifications]", message);
  }

  return result;
}

export async function updateContractSigningScheduleAndNotify(
  bookingId: string,
  schedule: {
    contractSigningDate: string;
    contractSigningTime: string;
  },
  options: {
    client?: DbClient;
  } = {},
): Promise<BookingStatusUpdateResult> {
  const client = options.client ?? db;
  const now = new Date().toISOString();

  const { data: booking, error: updateError } = await client
    .from("bookings")
    .update({
      contract_signing_date: schedule.contractSigningDate,
      contract_signing_time: schedule.contractSigningTime,
      updated_at: now,
    })
    .eq("id", bookingId)
    .select("id, status")
    .single();

  if (updateError || !booking) {
    throw new Error(updateError?.message ?? "Contract signing schedule update failed");
  }

  const result: BookingStatusUpdateResult = {
    booking: { id: booking.id, status: normalizeBookingStatus(booking.status) },
  };

  try {
    result.notification = await notifyContractSigningSchedule(bookingId, client);
    const warning = notificationWarning(result.notification);
    if (warning) {
      result.warning = warning;
      console.warn("[Notifications]", warning);
    }
  } catch (notificationError) {
    const message =
      notificationError instanceof Error ? notificationError.message : "Notification failed";
    result.warning = message;
    console.error("[Notifications]", message);
  }

  return result;
}
