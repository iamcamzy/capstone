// POST /api/bookings/ConfirmBookings — confirm a booking (admin only)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{ bookingId?: string }>(request);
  if (!body.ok) return body.response;

  const { bookingId } = body.data;
  if (!bookingId) return error("bookingId is required", 400);

  // Fetch current status
  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  if (booking.status === "confirmed") return error("Booking is already confirmed", 400);
  if (booking.status === "cancelled") return error("Cannot confirm a cancelled booking", 400);

  // Direct update — no RPC needed
  const { error: updateError } = await db
    .from("bookings")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (updateError) {
    console.error("[ConfirmBookings]", updateError.message);
    return error(updateError.message, 500);
  }

  return ok({ message: "Booking confirmed successfully" });
};
