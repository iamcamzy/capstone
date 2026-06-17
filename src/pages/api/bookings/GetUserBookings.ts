// GET /api/bookings/GetUserBookings — get current user's bookings (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { ok, error } from "../../../lib/response";
import { BOOKING_STATUSES, normalizeBookingStatus, type BookingStatus } from "../../../lib/bookingStatus";

export const prerender = false;

const VALID_STATUSES = [...BOOKING_STATUSES, "confirmed"];

export const GET: APIRoute = async ({ cookies, url }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const status = url.searchParams.get("status");
  const normalizedStatus = status ? normalizeBookingStatus(status) : null;
  if (status && !VALID_STATUSES.includes(status as BookingStatus | "confirmed")) {
    return error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  let query = supabase
    .from("bookings")
    .select(`
      id, start_date, end_date, event_date, event_type,
      pax, status, total_price, special_requests, created_at,
      venues ( id, name, image_url, price_per_night )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (normalizedStatus) query = query.eq("status", normalizedStatus);

  const { data, error: dbError } = await query;
  if (dbError) {
    console.error("[GetUserBookings]", dbError.message);
    return error(dbError.message, 500);
  }

  return ok({
    bookings: (data ?? []).map((booking) => ({
      ...booking,
      status: normalizeBookingStatus(booking.status),
    })),
  });
};
