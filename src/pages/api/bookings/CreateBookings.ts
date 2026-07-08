// POST /api/bookings/CreateBookings - create a booking (requires auth)
import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { createBookingSchema } from "../../../validation/booking";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const WOODBERRY_PACKAGES = {
  "lunch-time": {
    name: "Lunch Time Package",
    price: 12000,
    minPax: 80,
    maxPax: 200,
    inclusions: ["Pavilion", "Pool", "Sound system with DJ operator"],
  },
  "dinner-time": {
    name: "Dinner Time Package",
    price: 13000,
    minPax: 80,
    maxPax: 200,
    inclusions: ["Pavilion", "Pool", "Sound system with DJ operator"],
  },
  "barkada-staycation": {
    name: "Barkada Staycation",
    price: 14500,
    minPax: 10,
    maxPax: 15,
    inclusions: ["Pavilion", "Pool", "Videoke", "Tables/chairs", "2 rooms"],
  },
  "pamilya-staycation": {
    name: "Pamilya Staycation",
    price: 20500,
    minPax: 20,
    maxPax: 30,
    inclusions: ["Pavilion", "Pool", "Videoke", "Tables/chairs", "4 rooms"],
  },
  "room-rates": {
    name: "Room Rates",
    price: 0,
    minPax: 1,
    maxPax: 24,
    inclusions: ["Selected room accommodation", "Pool use not included"],
  },
} as const;

const ROOM_RATE_PRICES: Record<string, number> = {
  "room-1": 999,
  "room-2": 999,
  "room-3": 999,
  "room-4": 999,
  "room-5": 1499,
  "room-6": 1999,
  "room-extension": 200,
};

const ADD_ON_PRICES: Record<string, number> = {
  lights: 3500,
  projector: 1500,
  "big-tv": 1500,
  videoke: 500,
  room: 1000,
  "led-wall": 16000,
};

const EXTENSION_PRICES: Record<string, number> = {
  "pavilion-pool": 500,
  "sound-system": 400,
  "over-200-guests": 1000,
  "parking-attendant": 200,
};

const CORKAGE_PRICES: Record<string, number> = {
  "sound-system": 1000,
  "led-wall": 2000,
  lights: 1000,
  projector: 500,
  "electric-booth": 300,
  "electric-instrument": 300,
};

type RateItem = {
  key: string;
  label: string;
  price: number;
  quantity?: number;
  hours?: number;
  amount?: number;
};

function priceItems(items: RateItem[] | null | undefined, prices: Record<string, number>) {
  return (items ?? []).map((item) => {
    const unitPrice = prices[item.key] ?? 0;
    const multiplier = Math.max(1, Number(item.hours ?? item.quantity ?? 1));
    return {
      ...item,
      price: unitPrice,
      amount: unitPrice * multiplier,
    };
  });
}

function sumItems(items: RateItem[]) {
  return items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
}

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
    packageType,
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

  const { data: overlap, error: overlapError } = await db
    .from("bookings")
    .select("id")
    .eq("venue_id", venueId)
    .neq("status", "cancelled")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);

  if (overlapError) {
    console.error("[CreateBookings] Availability check failed", overlapError.message);
    return error("Could not verify venue availability. Please try again.", 500);
  }

  if (overlap && overlap.length > 0) {
    return error(
      "Selected dates overlap an existing non-cancelled booking for this venue. Please choose another date range.",
      409,
    );
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("price_per_night, is_active, name")
    .eq("id", venueId)
    .single();

  if (!venue) return error("Venue not found", 404);
  if (!venue.is_active) return error("This venue is not available for booking", 400);

  const selectedPackage = WOODBERRY_PACKAGES[packageType];
  if (!selectedPackage) return error("Selected Woodberry package is not available.", 400);
  if (!pax || pax < selectedPackage.minPax || pax > selectedPackage.maxPax) {
    return error(
      `${selectedPackage.name} allows ${selectedPackage.minPax}-${selectedPackage.maxPax} pax.`,
      400,
    );
  }

  const selectedRooms = priceItems(parsed.data.selectedRooms, ROOM_RATE_PRICES);
  const selectedAddOns = priceItems(parsed.data.addOns, ADD_ON_PRICES);
  const selectedExtensions = priceItems(parsed.data.extensionSelections, EXTENSION_PRICES);
  const selectedCorkage = priceItems(parsed.data.corkageSelections, CORKAGE_PRICES);
  const roomsTotal = sumItems(selectedRooms);
  const addOnsTotal = sumItems(selectedAddOns);
  const extensionsTotal = sumItems(selectedExtensions);
  const corkageTotal = sumItems(selectedCorkage);
  const packagePrice = selectedPackage.price;
  const computedTotal = packagePrice + roomsTotal + addOnsTotal + extensionsTotal + corkageTotal;
  const computedMinimumPayment = computedTotal * 0.5;
  const computedRemainingBalance = computedTotal - computedMinimumPayment;
  const estimateSummary = {
    packageBase: packagePrice,
    rooms: roomsTotal,
    addOns: addOnsTotal,
    extensions: extensionsTotal,
    corkage: corkageTotal,
    total: computedTotal,
    minimumPayment: computedMinimumPayment,
    remainingBalance: computedRemainingBalance,
  };

  const { data: newBooking, error: insertError } = await db
    .from("bookings")
    .insert({
      user_id: user.id,
      venue_id: venueId,
      start_date: startDate,
      end_date: endDate,
      event_date: eventDate ?? null,
      event_type: eventType ?? null,
      package_id: packageId ?? null,
      package_type: packageType,
      package_price: packagePrice,
      pax: pax ?? null,
      full_name: fullName ?? null,
      phone: phone ?? null,
      special_requests: specialRequests ?? null,
      total_price: computedTotal,
      status: "contract_signing",
      created_at: now,
      updated_at: now,
      address: parsed.data.address ?? null,
      caterer: parsed.data.useWoodberryCaterer ? "Woodberry's Caterer" : parsed.data.caterer ?? null,
      use_woodberry_caterer: parsed.data.useWoodberryCaterer ?? false,
      package_inclusions: {
        packageName: selectedPackage.name,
        included: selectedPackage.inclusions,
        requestedFacilities: parsed.data.packageInclusions ?? [],
      },
      rooms_count: parsed.data.roomsCount ?? null,
      selected_rooms: selectedRooms,
      facility_time_ranges: parsed.data.facilityTimeRanges ?? null,
      additionals: {
        rooms: selectedRooms,
        addOns: selectedAddOns,
        extensions: selectedExtensions,
        corkage: selectedCorkage,
      },
      add_ons: selectedAddOns,
      extension_selections: selectedExtensions,
      corkage_selections: selectedCorkage,
      estimate_summary: estimateSummary,
      minimum_payment_amount: computedMinimumPayment,
      remaining_balance_amount: computedRemainingBalance,
      terms_accepted_at: parsed.data.termsAccepted ? now : null,
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
