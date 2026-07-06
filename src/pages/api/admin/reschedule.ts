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
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isDateOnly(value: string) {
  return dateOnlyPattern.test(value) && !Number.isNaN(parseDateOnly(value).getTime());
}

function addOneCalendarMonth(date: Date) {
  const oneMonthLater = new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
  if (oneMonthLater.getDate() !== date.getDate()) {
    oneMonthLater.setDate(0);
  }
  return oneMonthLater;
}

function getMinimumBookingDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return addOneCalendarMonth(today);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{
    bookingId?: string;
    newStartDate?: string;
    newEndDate?: string;
    newEventDate?: string | null;
    adminOverrideOneMonth?: boolean;
  }>(request);
  if (!body.ok) return body.response;

  const { bookingId, newStartDate, newEndDate, adminOverrideOneMonth } = body.data;
  const newEventDate = body.data.newEventDate || null;

  if (!bookingId) return error("bookingId is required", 400);
  if (!newStartDate) return error("newStartDate is required", 400);
  if (!newEndDate) return error("newEndDate is required", 400);

  if (!isDateOnly(newStartDate)) return error("newStartDate must use YYYY-MM-DD", 400);
  if (!isDateOnly(newEndDate)) return error("newEndDate must use YYYY-MM-DD", 400);
  if (newEventDate && !isDateOnly(newEventDate)) {
    return error("newEventDate must use YYYY-MM-DD", 400);
  }

  const startDate = parseDateOnly(newStartDate);
  const endDate = parseDateOnly(newEndDate);
  const eventDate = newEventDate ? parseDateOnly(newEventDate) : null;

  if (endDate <= startDate) {
    return error("newEndDate must be after newStartDate", 400);
  }

  if (eventDate && (eventDate < startDate || eventDate > endDate)) {
    return error("newEventDate must fall within the new start and end dates", 400);
  }

  const minimumBookingDate = getMinimumBookingDate();
  const requiresOneMonthOverride =
    startDate < minimumBookingDate || (eventDate !== null && eventDate < minimumBookingDate);

  if (requiresOneMonthOverride && adminOverrideOneMonth !== true) {
    return error(
      "This reschedule is earlier than the normal one-month rule and requires admin override confirmation.",
      400,
    );
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
  if (bookingStatus === "completed") {
    return error("Cannot reschedule a completed booking", 400);
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
