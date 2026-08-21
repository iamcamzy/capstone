export const RESERVATION_EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

export type ReservationPayment = {
  payment_status?: string | null;
  amount_paid?: number | string | null;
} | null | undefined;

export type ReservationDeadlineBooking = {
  status?: string | null;
  reservation_expires_at?: string | null;
  reservation_expired_at?: string | null;
  cancellation_source?: string | null;
  payment?: ReservationPayment;
};

export type ReservationDeadlineStateKind =
  | "active_unpaid"
  | "expiring_soon"
  | "deadline_passed"
  | "expired_cancelled"
  | "paid_secured"
  | "cancelled"
  | "not_applicable";

export type ReservationDeadlineState = {
  kind: ReservationDeadlineStateKind;
  label: string;
  className: string;
  warning: boolean;
  remainingMs: number | null;
};

function normalizedPaymentStatus(payment: ReservationPayment): string {
  return payment?.payment_status?.trim().toLowerCase() || "unpaid";
}

function paymentAmount(payment: ReservationPayment): number {
  return Number(payment?.amount_paid ?? 0);
}

/** A missing payment row is treated as zero-paid; completed web payments always create one. */
export function isUnpaidPayment(payment: ReservationPayment): boolean {
  const status = normalizedPaymentStatus(payment);
  const amountPaid = paymentAmount(payment);

  if (status === "partial" || status === "paid") return false;
  return Number.isFinite(amountPaid) && amountPaid <= 0;
}

export function isSecuredPayment(payment: ReservationPayment): boolean {
  const status = normalizedPaymentStatus(payment);
  const amountPaid = paymentAmount(payment);

  return status === "partial"
    || status === "paid"
    || (Number.isFinite(amountPaid) && amountPaid > 0);
}

export function getReservationDeadlineState(
  booking: ReservationDeadlineBooking,
  nowMs = Date.now(),
): ReservationDeadlineState {
  const status = booking.status ?? "contract_signing";
  const expiresAtMs = booking.reservation_expires_at
    ? new Date(booking.reservation_expires_at).getTime()
    : null;
  const remainingMs = expiresAtMs !== null && Number.isFinite(expiresAtMs)
    ? expiresAtMs - nowMs
    : null;
  const expirationCancelled = status === "cancelled"
    && Boolean(booking.reservation_expired_at)
    && booking.cancellation_source === "system";

  if (expirationCancelled) {
    return {
      kind: "expired_cancelled",
      label: "Expired/cancelled",
      className: "reservation-expired",
      warning: false,
      remainingMs,
    };
  }

  if (status === "cancelled") {
    return {
      kind: "cancelled",
      label: "Cancelled",
      className: "reservation-expired",
      warning: false,
      remainingMs,
    };
  }

  if (
    isSecuredPayment(booking.payment)
    || status === "booked"
    || status === "rescheduled"
    || status === "completed"
  ) {
    return {
      kind: "paid_secured",
      label: "Paid/secured",
      className: "reservation-secured",
      warning: false,
      remainingMs,
    };
  }

  if (status !== "contract_signing") {
    return {
      kind: "not_applicable",
      label: "Not applicable",
      className: "reservation-active",
      warning: false,
      remainingMs,
    };
  }

  if (remainingMs !== null && remainingMs <= 0) {
    return {
      kind: "deadline_passed",
      label: "Deadline passed",
      className: "reservation-expired",
      warning: false,
      remainingMs,
    };
  }

  if (remainingMs !== null && remainingMs <= RESERVATION_EXPIRING_SOON_MS) {
    return {
      kind: "expiring_soon",
      label: "Expiring soon",
      className: "reservation-warning",
      warning: true,
      remainingMs,
    };
  }

  return {
    kind: "active_unpaid",
    label: "Active unpaid reservation",
    className: "reservation-active",
    warning: false,
    remainingMs,
  };
}
