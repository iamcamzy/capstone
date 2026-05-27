// GET /api/reviews/user — get current user's reviews (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { ok, error } from "../../../lib/response";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const { data: reviews, error: dbError } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, booking_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("[GetUserReviews]", dbError.message);
    return error(dbError.message, 500);
  }

  // Enrich with booking + venue info
  const bookingIds = (reviews ?? []).map((r) => r.booking_id);
  const { data: bookings } = bookingIds.length > 0
    ? await supabase
        .from("bookings")
        .select("id, start_date, end_date, event_date, venue_id")
        .in("id", bookingIds)
    : { data: [] };

  const venueIds = [...new Set((bookings ?? []).map((b) => b.venue_id))];
  const { data: venues } = venueIds.length > 0
    ? await supabase.from("venues").select("id, name").in("id", venueIds)
    : { data: [] };

  const bookingMap = Object.fromEntries((bookings ?? []).map((b) => [b.id, b]));
  const venueMap   = Object.fromEntries((venues ?? []).map((v) => [v.id, v.name]));

  const enriched = (reviews ?? []).map(({ booking_id, ...r }) => {
    const b = bookingMap[booking_id];
    return {
      ...r,
      booking: b ? {
        id:         b.id,
        start_date: b.start_date,
        end_date:   b.end_date,
        event_date: b.event_date,
        venue_name: venueMap[b.venue_id] ?? null,
      } : null,
    };
  });

  return ok({ reviews: enriched });
};
