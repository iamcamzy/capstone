import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import {
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
  bookingLoaded: boolean;
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

type BookingNotificationKind =
  | NotifiableBookingStatus
  | "booking_submitted"
  | "reminder"
  | "contract_signing_schedule"
  | "expiration_reminder"
  | "expiration_cancel_notice";

type NotificationContent = {
  subject: string;
  textContent: string;
  htmlContent: string;
  smsMessage: string;
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

function formatBookingDates(booking: NotificationBooking): string {
  return `${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}`;
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
): NotificationContent {
  const contractSigningSchedule = formatContractSigningSchedule(booking);
  const expirationDeadline = formatDateTime(booking.reservationExpiresAt);
  let subject: string;
  let statusLine: string;
  let statusMessage: string;

  switch (status) {
    case "booking_submitted":
      subject = "We received your Woodberry booking request";
      statusLine = "Thank you—your booking request has been received.";
      statusMessage =
        `Our team will review your details and contact you to arrange contract signing. ` +
        `Please complete the required payment by ${expirationDeadline} to keep this reservation active.`;
      break;
    case "reminder":
      subject = "Your Woodberry event is one week away";
      statusLine = `A friendly reminder that your event is scheduled for ${formatDate(booking.eventDate)}.`;
      statusMessage =
        "Please review your booking details and contact the Woodberry team if you have any final questions or updates.";
      break;
    case "contract_signing_schedule":
      subject = "Your Woodberry contract-signing schedule";
      statusLine = `Your contract signing is scheduled for ${contractSigningSchedule}.`;
      statusMessage =
        "Please come to Woodberry Resorts and Events Place at the scheduled time. Contact our team as soon as possible if you need help or cannot attend.";
      break;
    case "expiration_reminder":
      subject = "Action needed: your Woodberry reservation is expiring";
      statusLine = `Your unpaid reservation is being held until ${expirationDeadline}.`;
      statusMessage =
        "Please arrange the required payment before the deadline to keep your dates reserved. Contact the Woodberry team if you need assistance.";
      break;
    case "expiration_cancel_notice":
      subject = "Your Woodberry reservation has expired";
      statusLine = `Your unpaid reservation reached its deadline on ${expirationDeadline} and has been cancelled.`;
      statusMessage =
        "Your dates are no longer being held. If you would still like to book, please contact the Woodberry team so we can help you check availability and submit a new request.";
      break;
    case "contract_signing":
      subject = "Your Woodberry booking is ready for contract signing";
      statusLine = "Your booking request is ready for the contract-signing step.";
      statusMessage =
        "Our team will confirm your contract-signing schedule. Please contact Woodberry if you have not yet received the date and time or if you need assistance.";
      break;
    case "booked":
      subject = "Your Woodberry booking is confirmed";
      statusLine = "Your booking is confirmed and your event dates are reserved.";
      statusMessage =
        "Please review the details below and contact the Woodberry team if any information needs to be updated.";
      break;
    case "rescheduled":
      subject = "Your Woodberry booking schedule was updated";
      statusLine = `Your booking has been moved to ${formatBookingDates(booking)}.`;
      statusMessage =
        "Please review the updated dates below and contact the Woodberry team promptly if you have any questions.";
      break;
    case "cancelled":
      subject = "Your Woodberry booking was cancelled";
      statusLine = "Your booking has been cancelled and its dates are no longer being held.";
      statusMessage =
        "If this was unexpected or you would like help making a new booking, please contact the Woodberry team.";
      break;
    case "completed":
      subject = "Thank you for celebrating with Woodberry";
      statusLine = "Your Woodberry booking is now complete.";
      statusMessage =
        "Thank you for choosing Woodberry Resorts and Events Place. We hope to welcome you again.";
      break;
  }

  const includeContractSchedule = status === "contract_signing_schedule";
  const includeExpirationDeadline =
    status === "booking_submitted" ||
    status === "expiration_reminder" ||
    status === "expiration_cancel_notice";

  const lines = [
    `Hello ${booking.fullName},`,
    "",
    statusLine,
    "",
    "Booking Details:",
    `Venue: ${booking.venueName}`,
    `Package: ${booking.packageName}`,
    `Event Date: ${formatDate(booking.eventDate)}`,
    `Booking Dates: ${formatBookingDates(booking)}`,
    ...(includeContractSchedule ? [`Contract Signing: ${contractSigningSchedule}`] : []),
    `Reference ID: ${booking.id}`,
    ...(includeExpirationDeadline
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
    subject,
    textContent: lines.join("\n"),
    htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">${htmlLines
      .map((line) => (line ? `<p>${line}</p>` : "<br>"))
      .join("")}</div>`,
    smsMessage: [
      `Hello ${booking.fullName},`,
      statusLine,
      `${booking.venueName} — ${booking.packageName}.`,
      `Event: ${formatDate(booking.eventDate)}. Booking dates: ${formatBookingDates(booking)}.`,
      ...(includeContractSchedule ? [`Contract signing: ${contractSigningSchedule}.`] : []),
      ...(includeExpirationDeadline ? [`Deadline: ${expirationDeadline}.`] : []),
      statusMessage,
      `Reference: ${booking.id}.`,
      "— Woodberry Resorts and Events Place",
    ].join(" "),
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
    console.error("[Notifications] Booking fetch failed", {
      bookingId,
      error: bookingError?.message ?? "Booking not found",
    });
    return null;
  }

  const [customerResult, venueResult, packageResult] = await Promise.all([
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

  if (customerResult.error || !customerResult.data) {
    console.error("[Notifications] Customer preference fetch failed", {
      bookingId,
      error: customerResult.error?.message ?? "Customer profile not found",
    });
    return null;
  }

  const customer = customerResult.data;
  const venue = venueResult.data;
  const pkg = packageResult.data;

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

export async function notifyBookingSubmitted(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  return sendBookingNotification(booking, "booking_submitted");
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
        subject: content.subject,
        textContent: content.textContent,
        htmlContent: content.htmlContent,
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
        message: content.smsMessage,
      }),
    });
  }

  console.info("[Notifications] Delivery attempt", {
    bookingId: booking.id,
    kind: status,
    channels: tasks.map((task) => task.channel),
  });

  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  settled.forEach((settledResult, index) => {
    const channel = tasks[index].channel;
    if (settledResult.status === "rejected") {
      console.error("[Notifications] Channel request threw an error", {
        bookingId: booking.id,
        kind: status,
        channel,
        error:
          settledResult.reason instanceof Error
            ? settledResult.reason.message
            : `${channel.toUpperCase()} notification failed`,
      });
    }
    const value =
      settledResult.status === "fulfilled"
        ? settledResult.value
        : {
            ok: false as const,
            error: `${channel === "email" ? "Email" : "SMS"} notification could not be sent`,
          };

    if (channel === "email") {
      result.email = value as EmailSendResult;
    } else {
      result.sms = value as SmsSendResult;
    }
  });

  for (const channel of ["email", "sms"] as const) {
    const channelResult = result[channel];
    if (!channelResult) continue;
    if (delivered(channelResult)) {
      console.info("[Notifications] Channel succeeded", {
        bookingId: booking.id,
        kind: status,
        channel,
      });
    } else if (channelResult.ok) {
      console.info("[Notifications] Channel skipped", {
        bookingId: booking.id,
        kind: status,
        channel,
        reason: "reason" in channelResult ? channelResult.reason : "Not delivered",
      });
    } else {
      console.error("[Notifications] Channel failed", {
        bookingId: booking.id,
        kind: status,
        channel,
        error: channelResult.error,
      });
    }
  }

  return result;
}

function delivered(result: EmailSendResult | SmsSendResult | undefined): boolean {
  return Boolean(result?.ok && (!("skipped" in result) || !result.skipped));
}

function notificationWarning(result: NotificationResult): string | undefined {
  const unavailableChannels = (["email", "sms"] as const).filter((channel) => {
    const channelResult = result[channel];
    if (!channelResult) return false;
    if (!channelResult.ok) return true;
    if (!("skipped" in channelResult) || !channelResult.skipped) return false;
    return !(
      channelResult.reason.includes("disabled for this customer") ||
      channelResult.reason.includes("already sent")
    );
  });

  if (unavailableChannels.length === 0) return undefined;
  if (unavailableChannels.length === 2) {
    return "The booking was updated, but email and SMS notifications could not be sent.";
  }
  return `The booking was updated, but the ${unavailableChannels[0]} notification could not be sent.`;
}

export async function sendOneWeekReminder(
  bookingId: string,
  client: DbClient = db,
): Promise<OneWeekReminderResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) {
    return {
      bookingLoaded: false,
      enabledChannels: { email: false, sms: false },
      sentAt: { email: null, sms: null },
    };
  }

  const result = await sendBookingNotification(booking, "reminder");
  return {
    ...result,
    bookingLoaded: true,
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
      console.warn("[Notifications] Status notification incomplete", {
        bookingId,
        kind: normalizedStatus,
        warning,
      });
    }
  } catch (notificationError) {
    const message =
      notificationError instanceof Error ? notificationError.message : "Notification failed";
    result.warning = "The booking was updated, but its notification could not be sent.";
    console.error("[Notifications] Status notification failed", {
      bookingId,
      kind: normalizedStatus,
      error: message,
    });
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
      console.warn("[Notifications] Contract-signing notification incomplete", {
        bookingId,
        kind: "contract_signing_schedule",
        warning,
      });
    }
  } catch (notificationError) {
    const message =
      notificationError instanceof Error ? notificationError.message : "Notification failed";
    result.warning = "The schedule was updated, but its notification could not be sent.";
    console.error("[Notifications] Contract-signing notification failed", {
      bookingId,
      kind: "contract_signing_schedule",
      error: message,
    });
  }

  return result;
}
