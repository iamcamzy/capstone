// POST /api/admin/update-booking-status - update a booking status (admin only)
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { normalizeBookingStatus, type BookingStatus } from "../../../lib/bookingStatus";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { updateBookingStatusAndNotify } from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const ALLOWED_STATUS_UPDATES: BookingStatus[] = [
  "contract_signing",
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
];

const updateStatusSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
  status: z.string().min(1, "status is required"),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = updateStatusSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const status = normalizeBookingStatus(parsed.data.status);
  if (!ALLOWED_STATUS_UPDATES.includes(status)) {
    return error(`status must be one of: ${ALLOWED_STATUS_UPDATES.join(", ")}`, 400);
  }

  try {
    const result = await updateBookingStatusAndNotify(parsed.data.bookingId, status, { client: db });
    return ok({
      message: "Booking status updated successfully",
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[UpdateBookingStatus]", message);
    return error(message, 500);
  }
};

