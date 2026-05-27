// POST /api/bookings/ConfirmBookings — confirm a booking (admin only)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{ bookingId?: string }>(request);
  if (!body.ok) return body.response;

  const { bookingId } = body.data;
  if (!bookingId) return error("bookingId is required", 400);

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (!booking)                        return error("Booking not found", 404);
  if (booking.status === "confirmed")  return error("Booking is already confirmed", 400);
  if (booking.status === "cancelled")  return error("Cannot confirm a cancelled booking", 400);

  const { error: rpcError } = await supabase.rpc("confirm_booking", {
    p_booking_id: bookingId,
    p_user_id: guard.user.id,
  });

  if (rpcError) {
    console.error("[ConfirmBookings]", rpcError.message);
    return error(rpcError.message, 500);
  }

  return ok({ message: "Booking confirmed successfully" });
};
