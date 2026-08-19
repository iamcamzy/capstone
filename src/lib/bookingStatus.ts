import { z } from "zod";

export const BOOKING_STATUSES = [
  "contract_signing",
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
] as const;

export const NOTIFIABLE_BOOKING_STATUSES = [
  "contract_signing",
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type NotifiableBookingStatus = (typeof NOTIFIABLE_BOOKING_STATUSES)[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const BOOKING_ACTION_REASON_MAX_LENGTH = 500;
export const bookingActionReasonSchema = z.string().max(BOOKING_ACTION_REASON_MAX_LENGTH);

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  contract_signing: "Contract Signing",
  booked: "Booked",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function normalizeBookingStatus(status: string | null | undefined): BookingStatus {
  if (status === "pending") return "contract_signing";
  if (status === "confirmed") return "booked";
  if (BOOKING_STATUSES.includes(status as BookingStatus)) return status as BookingStatus;
  return "contract_signing";
}

export function isNotifiableBookingStatus(status: BookingStatus): status is NotifiableBookingStatus {
  return NOTIFIABLE_BOOKING_STATUSES.includes(status as NotifiableBookingStatus);
}

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  contract_signing: ["booked", "cancelled"],
  booked: ["rescheduled", "cancelled", "completed"],
  rescheduled: ["booked", "cancelled"],
  completed: [],
  cancelled: [],
};

export function getAllowedNextBookingStatuses(status: BookingStatus): readonly BookingStatus[] {
  return BOOKING_STATUS_TRANSITIONS[status];
}

export function normalizeBookingActionReason(reason: unknown): string {
  return typeof reason === "string" ? reason.trim() : "";
}

export function bookingActionReasonError(
  reason: unknown,
  label: "Cancellation" | "Override",
  required = true,
): string | null {
  const normalizedReason = normalizeBookingActionReason(reason);
  if (required && !normalizedReason) return `${label} reason is required.`;
  if (normalizedReason.length > BOOKING_ACTION_REASON_MAX_LENGTH) {
    return `${label} reason must be ${BOOKING_ACTION_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function isExpiredReservationCancellation(booking: {
  status: string | null | undefined;
  reservation_expired_at: string | null | undefined;
  cancellation_source: string | null | undefined;
}): boolean {
  return normalizeBookingStatus(booking.status) === "cancelled"
    && Boolean(booking.reservation_expired_at)
    && booking.cancellation_source === "system";
}

export function isValidBookingStatusTransition(
  from: BookingStatus,
  to: BookingStatus,
  options: { manualOverride?: boolean } = {},
): boolean {
  if (from === to) return true;
  if (from === "cancelled" && to === "booked" && options.manualOverride === true) {
    return true;
  }
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

export function bookingStatusTransitionErrorMessage(
  from: BookingStatus,
  to: BookingStatus,
  options: { manualOverride?: boolean } = {},
): string {
  if (isValidBookingStatusTransition(from, to, options)) return "";
  if (from === "completed") return "Completed bookings cannot be changed to another status.";
  if (from === "cancelled") {
    return "Cancelled bookings cannot be changed without an explicit admin manual override.";
  }
  return `Invalid booking status transition: ${BOOKING_STATUS_LABELS[from]} cannot be changed to ${BOOKING_STATUS_LABELS[to]}.`;
}
