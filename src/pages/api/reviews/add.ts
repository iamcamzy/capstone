// POST /api/reviews/add — add a review for a confirmed booking (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { addReviewSchema } from "../../../validation/review";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = addReviewSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { bookingId, rating, comment } = parsed.data;

  // Booking must exist, belong to user, and be confirmed
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, status")
    .eq("id", bookingId)
    .single();

  if (!booking)                      return error("Booking not found", 404);
  if (booking.user_id !== user.id)   return error("You can only review your own bookings", 403);
  if (booking.status !== "confirmed") return error("You can only review confirmed bookings", 400);

  // One review per booking
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return error("You have already reviewed this booking", 409);

  const { data: reviewId, error: rpcError } = await supabase.rpc("add_review", {
    p_user_id:    user.id,
    p_booking_id: bookingId,
    p_rating:     rating,
    p_comment:    comment ?? null,
  });

  if (rpcError) {
    console.error("[AddReview]", rpcError.message);
    return error(rpcError.message, 500);
  }

  return created({ reviewId, message: "Review added successfully" });
};
