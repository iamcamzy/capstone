import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import {
  BOOKING_STATUS_LABELS,
  bookingStatusTransitionErrorMessage,
  type BookingStatus,
  type NotifiableBookingStatus,
  isValidBookingStatusTransition,
  isNotifiableBookingStatus,
  normalizeBookingStatus,
} from "../lib/bookingStatus";
import { supabaseAdmin, supabase } from "../lib/supabase";
import { logBookingAudit, type BookingAuditActorType } from "./bookingAudit";
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
  oneWeekEmailSentAt: string | null;
  oneWeekSmsSentAt: string | null;
  reservationExpiresAt: string;
  expirationReminderSentAt: string | null;
  expirationCancelNoticeSentAt: string | null;
};

export type NotificationResult = {
  email?: EmailSendResult;
  sms?: SmsSendResult;
};

export type OneWeekReminderResult = NotificationResult & {
  enabledChannels: {
    email: boolean;
    sms: boolean;
  };
  sentAt: {
    email: string | null;
    sms: string | null;
  };
};

export type BookingStatusUpdateResult = {
  booking: { id: string; status: BookingStatus };
  notification?: NotificationResult;
  message?: string;
  unchanged?: boolean;
  warning?: string;
};

const db = supabaseAdmin ?? supabase;
const CONTRACT_SIGNING_SCHEDULE_STATUSES: BookingStatus[] = ["contract_signing", "rescheduled"];
const CONTRACT_SIGNING_SCHEDULE_STATUS_MESSAGE =
  "Contract signing schedule can only be updated for bookings with Contract Signing or Rescheduled status.";

export class ContractSigningScheduleStatusError extends Error {
  constructor() {
    super(CONTRACT_SIGNING_SCHEDULE_STATUS_MESSAGE);
    this.name = "ContractSigningScheduleStatusError";
  }
}

export class BookingStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingStatusTransitionError";
  }
}

const STATUS_MESSAGES: Record<NotifiableBookingStatus, string> = {
  contract_signing:
    "Your booking is ready for contract signing. Please coordinate with the resort team for the next steps.",
  booked: "Your booking has been officially booked.",
  rescheduled: "Your booking has been rescheduled. Please review the updated event details.",
  cancelled: "Your booking has been cancelled.",
  completed: "Thank you for choosing us. Your event has been marked completed.",
};

type BookingNotificationKind =
  | NotifiableBookingStatus
  | "reminder"
  | "contract_signing_schedule"
  | "expiration_reminder"
  | "expiration_cancel_notice";

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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "the stated reservation deadline";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "the stated reservation deadline";
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
    timeZoneName: "short",
  });
}

function normalizeScheduleTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const [hour, minute] = value.split(":");
  if (!hour || !minute) return value;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
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
  const isExpirationReminder = status === "expiration_reminder";
  const isExpirationCancelNotice = status === "expiration_cancel_notice";
  const contractSigningSchedule = formatContractSigningSchedule(booking);
  const expirationDeadline = formatDateTime(booking.reservationExpiresAt);
  const label =
    status === "reminder"
      ? "1-Week Reminder"
      : isExpirationReminder
        ? "Reservation Expiration Reminder"
        : isExpirationCancelNotice
          ? "Reservation Cancelled"
      : isScheduleNotification
        ? "Contract Signing Schedule"
        : BOOKING_STATUS_LABELS[status];
  const statusLine =
    status === "reminder"
      ? "Your event is scheduled one week from now."
      : isExpirationReminder
        ? `Your unpaid reservation will expire on ${expirationDeadline}.`
        : isExpirationCancelNotice
          ? `Your unpaid reservation expired on ${expirationDeadline} and has been automatically cancelled.`
      : isScheduleNotification
        ? `Your contract signing is scheduled for ${contractSigningSchedule}.`
        : `Your booking status has been updated to: ${label}.`;
  const statusMessage =
    status === "reminder"
      ? "Your event is scheduled one week from now. Please coordinate any remaining details with Woodberry Resorts and Events Place."
      : isExpirationReminder
        ? "Please arrange the required payment before the deadline to keep your reservation."
        : isExpirationCancelNotice
          ? "If you still wish to proceed or need assistance, please contact Woodberry or an administrator."
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
    ...(isExpirationReminder || isExpirationCancelNotice
      ? [`Expiration Deadline: ${expirationDeadline}`]
      : []),
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
      "id, user_id, status, full_name, phone, event_date, start_date, end_date, contract_signing_date, contract_signing_time, package_id, venue_id, one_week_email_sent_at, one_week_sms_sent_at, reservation_expires_at, expiration_reminder_sent_at, expiration_cancel_notice_sent_at",
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
    oneWeekEmailSentAt: booking.one_week_email_sent_at,
    oneWeekSmsSentAt: booking.one_week_sms_sent_at,
    reservationExpiresAt: booking.reservation_expires_at,
    expirationReminderSentAt: booking.expiration_reminder_sent_at,
    expirationCancelNoticeSentAt: booking.expiration_cancel_notice_sent_at,
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
  const isReminder = status === "reminder";

  if (!booking.emailNotificationsEnabled) {
    result.email = { ok: true, skipped: true, reason: "Email notifications are disabled for this customer" };
  } else if (isReminder && booking.oneWeekEmailSentAt) {
    result.email = { ok: true, skipped: true, reason: "One-week email reminder was already sent" };
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
  } else if (isReminder && booking.oneWeekSmsSentAt) {
    result.sms = { ok: true, skipped: true, reason: "One-week SMS reminder was already sent" };
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
): Promise<OneWeekReminderResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) {
    return {
      enabledChannels: { email: false, sms: false },
      sentAt: { email: null, sms: null },
    };
  }

  const result = await sendBookingNotification(booking, "reminder");
  return {
    ...result,
    enabledChannels: {
      email: booking.emailNotificationsEnabled,
      sms: booking.smsNotificationsEnabled,
    },
    sentAt: {
      email: booking.oneWeekEmailSentAt,
      sms: booking.oneWeekSmsSentAt,
    },
  };
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

export async function sendExpirationReminder(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking || booking.expirationReminderSentAt) return {};
  return sendBookingNotification(booking, "expiration_reminder");
}

export async function sendExpirationCancellationNotice(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking || booking.expirationCancelNoticeSentAt) return {};
  return sendBookingNotification(booking, "expiration_cancel_notice");
}

export function notificationChannelSucceeded(
  result: EmailSendResult | SmsSendResult | undefined,
): boolean {
  return delivered(result);
}

function statusAuditAction(
  fromStatus: BookingStatus,
  toStatus: BookingStatus,
  manualOverride?: boolean,
): string {
  if (manualOverride) return "manual_override";
  if (toStatus === "cancelled") return "booking_cancelled";
  if (toStatus === "rescheduled") return "booking_rescheduled";
  if (toStatus === "booked" && fromStatus === "rescheduled") return "booking_rebooked";
  if (toStatus === "booked") return "booking_booked";
  if (toStatus === "completed") return "booking_completed";
  return "booking_status_changed";
}

export async function updateBookingStatusAndNotify(
  bookingId: string,
  newStatus: BookingStatus,
  options: {
    client?: DbClient;
    update?: Record<string, unknown>;
    notify?: boolean;
    manualOverride?: boolean;
    actorId?: string | null;
    actorType?: BookingAuditActorType;
    action?: string;
    reason?: string | null;
    metadata?: Json;
  } = {},
): Promise<BookingStatusUpdateResult> {
  const client = options.client ?? db;
  const now = new Date().toISOString();
  const normalizedStatus = normalizeBookingStatus(newStatus);

  const { data: currentBooking, error: fetchError } = await client
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !currentBooking) {
    throw new Error(fetchError?.message ?? "Booking not found");
  }

  const currentStatus = normalizeBookingStatus(currentBooking.status);
  if (
    !isValidBookingStatusTransition(currentStatus, normalizedStatus, {
      manualOverride: options.manualOverride,
    })
  ) {
    throw new BookingStatusTransitionError(
      bookingStatusTransitionErrorMessage(currentStatus, normalizedStatus, {
        manualOverride: options.manualOverride,
      }),
    );
  }

  if (currentStatus === normalizedStatus) {
    return {
      booking: { id: currentBooking.id, status: currentStatus },
      message: "Booking status unchanged.",
      unchanged: true,
    };
  }

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
    .eq("status", currentBooking.status)
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }
  if (!booking) {
    throw new BookingStatusTransitionError(
      "Booking status changed while this action was being processed. Refresh and try again.",
    );
  }

  await logBookingAudit(
    {
      bookingId,
      actorId: options.actorId ?? null,
      actorType: options.actorType ?? "system",
      action: options.action ?? statusAuditAction(currentStatus, normalizedStatus, options.manualOverride),
      fromStatus: currentStatus,
      toStatus: normalizedStatus,
      reason: options.reason ?? null,
      metadata: {
        ...(typeof options.metadata === "object" && options.metadata !== null && !Array.isArray(options.metadata)
          ? options.metadata
          : {}),
        manualOverride: options.manualOverride === true,
      },
    },
    client,
  );

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
    actorId?: string | null;
    actorType?: BookingAuditActorType;
    reason?: string | null;
    metadata?: Json;
  } = {},
): Promise<BookingStatusUpdateResult> {
  const client = options.client ?? db;
  const now = new Date().toISOString();

  const { data: currentBooking, error: fetchError } = await client
    .from("bookings")
    .select("id, status, contract_signing_date, contract_signing_time")
    .eq("id", bookingId)
    .single();

  if (fetchError || !currentBooking) {
    throw new Error(fetchError?.message ?? "Booking not found");
  }

  const currentStatus = normalizeBookingStatus(currentBooking.status);
  if (!CONTRACT_SIGNING_SCHEDULE_STATUSES.includes(currentStatus)) {
    throw new ContractSigningScheduleStatusError();
  }

  const currentDate = currentBooking.contract_signing_date ?? null;
  const currentTime = normalizeScheduleTime(currentBooking.contract_signing_time);
  const newTime = normalizeScheduleTime(schedule.contractSigningTime);

  if (currentDate === schedule.contractSigningDate && currentTime === newTime) {
    return {
      booking: { id: currentBooking.id, status: currentStatus },
      message: "Contract signing schedule unchanged.",
      unchanged: true,
    };
  }

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

  await logBookingAudit(
    {
      bookingId,
      actorId: options.actorId ?? null,
      actorType: options.actorType ?? "system",
      action: "contract_signing_schedule_updated",
      fromStatus: currentStatus,
      toStatus: normalizeBookingStatus(booking.status),
      reason: options.reason ?? null,
      metadata: {
        oldContractSigningDate: currentDate,
        oldContractSigningTime: currentTime,
        newContractSigningDate: schedule.contractSigningDate,
        newContractSigningTime: newTime,
      },
    },
    client,
  );

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
