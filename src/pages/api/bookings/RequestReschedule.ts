// POST /api/bookings/RequestReschedule — customer requests a booking reschedule
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const body = await parseBody<{
    bookingId?: string;
    newStartDate?: string;
    newEndDate?: string;
    newEventDate?: string;
    reason?: string;
  }>(request);
  if (!body.ok) return body.response;

  const { bookingId, newStartDate, newEndDate, newEventDate, reason } = body.data;

  if (!bookingId) return error("bookingId is required", 400);
  if (!newStartDate) return error("newStartDate is required", 400);
  if (!newEndDate) return error("newEndDate is required", 400);

  if (new Date(newEndDate) <= new Date(newStartDate)) {
    return error("newEndDate must be after newStartDate", 400);
  }

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, user_id, status, special_requests")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  if (booking.user_id !== user.id) return error("You can only reschedule your own bookings", 403);
  if (booking.status === "cancelled") return error("Cannot reschedule a cancelled booking", 400);

  const requestDate = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const note = [
    "",
    "--- Reschedule Request ---",
    `Requested on: ${requestDate}`,
    `New check-in: ${newStartDate}`,
    `New check-out: ${newEndDate}`,
    newEventDate ? `New event date: ${newEventDate}` : null,
    reason ? `Reason: ${reason}` : null,
  ].filter(Boolean).join("\n");

  const { error: updateError } = await db
    .from("bookings")
    .update({
      status: "rescheduled",
      start_date: newStartDate,
      end_date: newEndDate,
      event_date: newEventDate || null,
      special_requests: `${booking.special_requests ?? ""}${note}`.trim(),
      rescheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (updateError) {
    console.error("[RequestReschedule]", updateError.message);
    return error(updateError.message, 500);
  }

  return ok({ message: "Reschedule request submitted successfully", bookingId });
};
