// POST /api/bookings/CreateBookings - create a booking (requires auth)
import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { createBookingSchema } from "../../../validation/booking";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized - please sign in", 401);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = createBookingSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const {
    venueId,
    startDate,
    endDate,
    eventDate,
    eventType,
    packageId,
    pax,
    fullName,
    email,
    phone,
    specialRequests,
    emailNotificationsEnabled,
    smsNotificationsEnabled,
  } = parsed.data;

  const db = supabaseAdmin ?? supabase;
  const now = new Date().toISOString();

  // Keep the latest booking contact info on the customer profile.
  // The notification service reads the customer profile, so the latest booking
  // contact details and notification preference must be saved before staff act.
  if (email || fullName || phone || parsed.data.notificationPreference) {
    const [firstName, ...lastNameParts] = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
    const profileUpdate = {
      id: user.id,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastNameParts.length ? { last_name: lastNameParts.join(" ") } : {}),
      email_notifications_enabled: emailNotificationsEnabled,
      sms_notifications_enabled: smsNotificationsEnabled,
      updated_at: now,
    };

    const { error: profileError } = await db
      .from("customers")
      .upsert(profileUpdate, { onConflict: "id" });

    if (profileError) {
      console.warn("[CreateBookings] Customer contact update failed", profileError.message);
    }
  }

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

  const { data: venue } = await supabase
    .from("venues")
    .select("price_per_night, is_active, name")
    .eq("id", venueId)
    .single();

  if (!venue) return error("Venue not found", 404);
  if (!venue.is_active) return error("This venue is not available for booking", 400);

  const nights = Math.max(
    1,
    Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000),
  );
  const totalPrice = nights * Number(venue.price_per_night);

  let packagePrice = 0;
  if (packageId) {
    const { data: pkg } = await supabase
      .from("packages")
      .select("price")
      .eq("id", packageId)
      .single();
    if (pkg) packagePrice = Number(pkg.price);
  }

  const computedTotal = totalPrice + packagePrice;
  const computedMinimumPayment = computedTotal * 0.5;
  const computedRemainingBalance = computedTotal - computedMinimumPayment;

  const { data: newBooking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      user_id: user.id,
      venue_id: venueId,
      start_date: startDate,
      end_date: endDate,
      event_date: eventDate ?? null,
      event_type: eventType ?? null,
      package_id: packageId ?? null,
      pax: pax ?? null,
      full_name: fullName ?? null,
      phone: phone ?? null,
      special_requests: specialRequests ?? null,
      total_price: computedTotal,
      status: "contract_signing",
      created_at: now,
      updated_at: now,
      // TODO: Enable after booking database columns are added.
      // address: parsed.data.address ?? null,
      // caterer: parsed.data.useWoodberryCaterer ? "Woodberry's Caterer" : parsed.data.caterer ?? null,
      // use_woodberry_caterer: parsed.data.useWoodberryCaterer ?? false,
      // package_inclusions: parsed.data.packageInclusions ?? null,
      // rooms_count: parsed.data.roomsCount ?? null,
      // facility_time_ranges: parsed.data.facilityTimeRanges ?? null,
      // additionals: parsed.data.additionals ?? null,
      // minimum_payment_amount: computedMinimumPayment,
      // remaining_balance_amount: computedRemainingBalance,
      // terms_accepted_at: parsed.data.termsAccepted ? now : null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[CreateBookings]", insertError.message);
    return error(insertError.message, 500);
  }

  return created({
    bookingId: newBooking.id,
    totalPrice: computedTotal,
    message: "Booking submitted successfully. Our staff will coordinate contract signing details.",
  });
};
