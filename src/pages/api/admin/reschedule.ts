// POST /api/admin/reschedule — reschedule a booking (admin only)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import type { Database } from "../../../lib/database.types";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{
    bookingId?: string;
    newStartDate?: string;
    newEndDate?: string;
    newEventDate?: string;
  }>(request);
  if (!body.ok) return body.response;

  const { bookingId, newStartDate, newEndDate, newEventDate } = body.data;

  if (!bookingId)    return error("bookingId is required", 400);
  if (!newStartDate) return error("newStartDate is required", 400);
  if (!newEndDate)   return error("newEndDate is required", 400);

  if (new Date(newEndDate) <= new Date(newStartDate)) {
    return error("newEndDate must be after newStartDate", 400);
  }

  // Fetch booking to confirm it exists
  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  if (booking.status === "cancelled") return error("Cannot reschedule a cancelled booking", 400);

  // Build a typed update object so Supabase only receives valid booking columns.
  const now = new Date().toISOString();
  const updateData: Database["public"]["Tables"]["bookings"]["Update"] = {
    status: "rescheduled",
    start_date: newStartDate,
    end_date: newEndDate,
    rescheduled_at: now,
    updated_at: now,
  };
  if (newEventDate) updateData.event_date = newEventDate;

  const { error: updateError } = await db
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId);

  if (updateError) {
    console.error("[Reschedule]", updateError.message);
    return error(updateError.message, 500);
  }

  return ok({ message: "Booking rescheduled successfully", bookingId });
};
