// POST /api/bookings/CancelBookings — cancel own booking (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const body = await parseBody<{ bookingId?: string }>(request);
  if (!body.ok) return body.response;

  const { bookingId } = body.data;
  if (!bookingId) return error("bookingId is required", 400);

  // Verify ownership
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, user_id")
    .eq("id", bookingId)
    .single();

  if (!booking)                      return error("Booking not found", 404);
  if (booking.user_id !== user.id)   return error("You can only cancel your own bookings", 403);
  if (booking.status === "cancelled") return error("Booking is already cancelled", 400);

  const { error: rpcError } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_user_id: user.id,
  });

  if (rpcError) {
    console.error("[CancelBookings]", rpcError.message);
    return error(rpcError.message, 500);
  }

  return ok({ message: "Booking cancelled successfully" });
};
