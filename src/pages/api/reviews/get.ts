// GET /api/reviews/get?venueId= — get reviews for a venue (public)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { ok, error } from "../../../lib/response";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const venueId = url.searchParams.get("venueId");
  if (!venueId) return error("venueId is required", 400);

  const page   = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1"));
  const limit  = Math.min(50, parseInt(url.searchParams.get("limit") ?? "10"));
  const offset = (page - 1) * limit;

  // Get reviews for bookings at this venue
  const { data: bookingIds } = await supabase
    .from("bookings")
    .select("id")
    .eq("venue_id", venueId)
    .eq("status", "confirmed");

  if (!bookingIds || bookingIds.length === 0) {
    return ok({ reviews: [], averageRating: null,
      pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  const ids = bookingIds.map((b) => b.id);

  const { data, error: dbError, count } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, user_id", { count: "exact" })
    .in("booking_id", ids)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbError) {
    console.error("[GetReviews]", dbError.message);
    return error(dbError.message, 500);
  }

  // Attach reviewer names
  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from("customers").select("id, first_name, last_name").in("id", userIds)
    : { data: [] };

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  const reviews = (data ?? []).map(({ user_id, ...r }) => ({
    ...r,
    reviewer: userMap[user_id]
      ? { first_name: userMap[user_id].first_name, last_name: userMap[user_id].last_name }
      : null,
  }));

  const avg = reviews.length > 0
    ? parseFloat((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1))
    : null;

  return ok({
    reviews,
    averageRating: avg,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  });
};
