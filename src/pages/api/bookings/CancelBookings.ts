// POST /api/bookings/CancelBookings - cancel a booking (staff/admin or booking owner)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { getUserRole } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import {
  bookingActionReasonError,
  normalizeBookingActionReason,
  normalizeBookingStatus,
} from "../../../lib/bookingStatus";
import {
  BookingStatusTransitionError,
  updateBookingStatusAndNotify,
} from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const roleInfo = await getUserRole(cookies);
  if (!roleInfo.user || roleInfo.role === "none") {
    return error("Unauthorized - please sign in", 401);
  }
  const user = roleInfo.user;

  const body = await parseBody<{
    bookingId?: string;
    cancellationReason?: string;
    confirmedSensitiveAction?: boolean;
  }>(request);
  if (!body.ok) return body.response;

  const { bookingId } = body.data;
  if (!bookingId) return error("bookingId is required", 400);
  const cancellationReason = normalizeBookingActionReason(body.data.cancellationReason);

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status, user_id")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  const bookingStatus = normalizeBookingStatus(booking.status);
  if (bookingStatus === "cancelled") return error("Booking is already cancelled", 400);
  if (bookingStatus === "completed") return error("Cannot cancel a completed booking", 400);

  const isInternalUser = roleInfo.role === "admin" || roleInfo.role === "staff";
  if (!isInternalUser && booking.user_id !== user.id) {
    return error("You can only cancel your own bookings", 403);
  }
  const cancellationReasonError = bookingActionReasonError(
    cancellationReason,
    "Cancellation",
    isInternalUser,
  );
  if (cancellationReasonError) return error(cancellationReasonError, 400);
  if (isInternalUser && body.data.confirmedSensitiveAction !== true) {
    return error("Explicit confirmation is required before cancelling a booking.", 400);
  }

  try {
    const result = await updateBookingStatusAndNotify(bookingId, "cancelled", {
      client: db,
      actorId: user.id,
      actorType: isInternalUser ? roleInfo.role : "customer",
      reason: cancellationReason || null,
      ...(isInternalUser
        ? {
            update: {
              cancellation_reason: cancellationReason,
              cancellation_source: `${roleInfo.role}_manual`,
            },
          }
        : {}),
    });
    return ok({
      message: "Booking cancelled successfully",
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[CancelBookings]", message);
    if (updateError instanceof BookingStatusTransitionError) {
      return error(message, 409);
    }
    return error(message, 500);
  }
};
