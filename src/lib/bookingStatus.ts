import { z } from "zod";

export const BOOKING_STATUSES = [
  "pending",
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

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  contract_signing: "Contract Signing",
  booked: "Booked",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function normalizeBookingStatus(status: string | null | undefined): BookingStatus {
  if (status === "confirmed") return "booked";
  if (BOOKING_STATUSES.includes(status as BookingStatus)) return status as BookingStatus;
  return "pending";
}

export function isNotifiableBookingStatus(status: BookingStatus): status is NotifiableBookingStatus {
  return NOTIFIABLE_BOOKING_STATUSES.includes(status as NotifiableBookingStatus);
}

