// POST /api/bookings/CancelBookings - cancel a booking (admin or booking owner)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { updateBookingStatusAndNotify } from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized - please sign in", 401);

  const body = await parseBody<{ bookingId?: string }>(request);
  if (!body.ok) return body.response;

  const { bookingId } = body.data;
  if (!bookingId) return error("bookingId is required", 400);

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status, user_id")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  if (booking.status === "cancelled") return error("Booking is already cancelled", 400);

  const { data: adminRow } = await db.from("admins").select("id").eq("id", user.id).single();
  const isAdmin = !!adminRow;
  if (!isAdmin && booking.user_id !== user.id) {
    return error("You can only cancel your own bookings", 403);
  }

  try {
    const result = await updateBookingStatusAndNotify(bookingId, "cancelled", { client: db });
    return ok({
      message: "Booking cancelled successfully",
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[CancelBookings]", message);
    return error(message, 500);
  }
};
