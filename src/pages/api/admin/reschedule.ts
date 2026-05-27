// POST /api/admin/reschedule — reschedule a booking (admin only)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

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

  const { data: newBookingId, error: rpcError } = await supabase.rpc("reschedule_booking", {
    p_booking_id:     bookingId,
    p_new_start:      newStartDate,
    p_new_end:        newEndDate,
    p_new_event_date: newEventDate ?? null,
  } as any);

  if (rpcError) {
    console.error("[Reschedule]", rpcError.message);
    return error(rpcError.message, 500);
  }

  return ok({ message: "Booking rescheduled successfully", newBookingId });
};
