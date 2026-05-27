// POST /api/bookings/CreateBookings — create a booking (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { createBookingSchema } from "../../../validation/booking";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  // 1. Auth
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  // 2. Parse body
  const body = await parseBody(request);
  if (!body.ok) return body.response;

  // 3. Validate
  const parsed = createBookingSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { venueId, startDate, endDate, eventDate, eventType, packageId, pax,
          fullName, phone, specialRequests } = parsed.data;

  // 4. Overlap check — prevent double-booking
  const { data: overlap } = await supabase
    .from("bookings")
    .select("id")
    .eq("venue_id", venueId)
    .not("status", "in", '("cancelled","rescheduled")')
    .lt("start_date", endDate)
    .gt("end_date", startDate)
    .limit(1);

  if (overlap && overlap.length > 0) {
    return error("This venue is already booked for the selected dates", 409);
  }

  // 5. Venue exists and is active
  const { data: venue } = await supabase
    .from("venues")
    .select("price_per_night, is_active, name")
    .eq("id", venueId)
    .single();

  if (!venue)         return error("Venue not found", 404);
  if (!venue.is_active) return error("This venue is not available for booking", 400);

  // 6. Create via stored procedure (handles price calc + status timestamps)
  const { data: bookingId, error: rpcError } = await supabase.rpc("create_booking", {
    p_user_id:          user.id,
    p_venue_id:         venueId,
    p_start_date:       startDate,
    p_end_date:         endDate,
    p_event_date:       eventDate        ?? null,
    p_event_type:       eventType        ?? null,
    p_package_id:       packageId        ?? null,
    p_pax:              pax              ?? null,
    p_full_name:        fullName         ?? null,
    p_phone:            phone            ?? null,
    p_special_requests: specialRequests  ?? null,
  });

  if (rpcError) {
    console.error("[CreateBookings]", rpcError.message);
    return error(rpcError.message, 500);
  }

  // 7. Calculate price for the response (for display — actual price is set by the RPC)
  const nights = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
  );
  const totalPrice = nights * Number(venue.price_per_night);

  return created({ bookingId, totalPrice, message: "Booking created successfully" });
};
