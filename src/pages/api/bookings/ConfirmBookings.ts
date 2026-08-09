// POST /api/bookings/ConfirmBookings - book a booking (staff or admin)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { staffOrAdminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";
import {
  BookingStatusTransitionError,
  updateBookingStatusAndNotify,
} from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await staffOrAdminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{ bookingId?: string }>(request);
  if (!body.ok) return body.response;

  const { bookingId } = body.data;
  if (!bookingId) return error("bookingId is required", 400);

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  const bookingStatus = normalizeBookingStatus(booking.status);
  if (bookingStatus === "booked") {
    return error("Booking is already booked", 400);
  }
  if (bookingStatus === "cancelled") {
    return error("Cannot book a cancelled booking", 400);
  }
  if (bookingStatus !== "contract_signing" && bookingStatus !== "rescheduled") {
    return error("Only contract signing or rescheduled bookings can be booked", 400);
  }

  try {
    const result = await updateBookingStatusAndNotify(bookingId, "booked", {
      client: db,
      actorId: guard.user.id,
      actorType: guard.role,
    });
    return ok({
      message: "Booking booked successfully",
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[ConfirmBookings]", message);
    if (updateError instanceof BookingStatusTransitionError) {
      return error(message, 409);
    }
    return error(message, 500);
  }
};
