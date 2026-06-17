// POST /api/bookings/CreateBookings — create a booking (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { createBookingSchema } from "../../../validation/booking";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = createBookingSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { venueId, startDate, endDate, eventDate, eventType, packageId, pax,
          fullName, phone, specialRequests } = parsed.data;

  // Overlap check
  const { data: overlap } = await supabase
    .from("bookings")
    .select("id")
    .eq("venue_id", venueId)
    .neq("status", "cancelled")
    .lt("start_date", endDate)
    .gt("end_date", startDate)
    .limit(1);

  if (overlap && overlap.length > 0) {
    return error("This venue is already booked for the selected dates", 409);
  }

  // Venue check
  const { data: venue } = await supabase
    .from("venues")
    .select("price_per_night, is_active, name")
    .eq("id", venueId)
    .single();

  if (!venue)           return error("Venue not found", 404);
  if (!venue.is_active) return error("This venue is not available for booking", 400);

  // Calculate price
  const nights = Math.max(1, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000
  ));
  const totalPrice = nights * Number(venue.price_per_night);

  // Package price addition
  let packagePrice = 0;
  if (packageId) {
    const { data: pkg } = await supabase
      .from("packages")
      .select("price")
      .eq("id", packageId)
      .single();
    if (pkg) packagePrice = Number(pkg.price);
  }

  // Direct insert — no RPC needed
  const { data: newBooking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      user_id:          user.id,
      venue_id:         venueId,
      start_date:       startDate,
      end_date:         endDate,
      event_date:       eventDate        ?? null,
      event_type:       eventType        ?? null,
      package_id:       packageId        ?? null,
      pax:              pax              ?? null,
      full_name:        fullName         ?? null,
      phone:            phone            ?? null,
      special_requests: specialRequests  ?? null,
      total_price:      totalPrice + packagePrice,
      status:           "pending",
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[CreateBookings]", insertError.message);
    return error(insertError.message, 500);
  }

  return created({
    bookingId:   newBooking.id,
    totalPrice:  totalPrice + packagePrice,
    message:     "Booking created successfully",
  });
};
