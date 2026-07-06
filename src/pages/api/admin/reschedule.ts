// POST /api/admin/reschedule - reschedule a booking (admin only)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";
import { updateBookingStatusAndNotify } from "../../../services/notifications";

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

  if (!bookingId) return error("bookingId is required", 400);
  if (!newStartDate) return error("newStartDate is required", 400);
  if (!newEndDate) return error("newEndDate is required", 400);

  if (new Date(newEndDate) <= new Date(newStartDate)) {
    return error("newEndDate must be after newStartDate", 400);
  }

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status, venue_id")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  const bookingStatus = normalizeBookingStatus(booking.status);
  if (bookingStatus === "cancelled") {
    return error("Cannot reschedule a cancelled booking", 400);
  }
  if (bookingStatus === "completed" || bookingStatus === "rescheduled") {
    return error("Only contract signing or booked bookings can be rescheduled", 400);
  }

  const { data: overlap, error: overlapError } = await db
    .from("bookings")
    .select("id")
    .eq("venue_id", booking.venue_id)
    .neq("id", bookingId)
    .neq("status", "cancelled")
    .lte("start_date", newEndDate)
    .gte("end_date", newStartDate)
    .limit(1);

  if (overlapError) {
    console.error("[Reschedule] Availability check failed", overlapError.message);
    return error("Could not verify venue availability. Please try again.", 500);
  }

  if (overlap && overlap.length > 0) {
    return error(
      "Selected dates overlap an existing non-cancelled booking for this venue. Please choose another date range.",
      409,
    );
  }

  const updateData: Record<string, string> = {
    start_date: newStartDate,
    end_date: newEndDate,
  };
  if (newEventDate) updateData.event_date = newEventDate;

  try {
    const result = await updateBookingStatusAndNotify(bookingId, "rescheduled", {
      client: db,
      update: updateData,
    });
    return ok({
      message: "Booking rescheduled successfully",
      bookingId,
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[Reschedule]", message);
    return error(message, 500);
  }
};
