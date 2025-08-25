// src/services/reviews.ts
import { supabase } from "../lib/supabase";

// Create review
export async function createReview(review: any) {
    const { data, error } = await supabase
        .from("reviews")
        .insert([review])
        .select();
    return { data, error };
}

// Get reviews for a venue
export async function getVenueReviews(venueId: string) {
    const { data, error } = await supabase
        .from("reviews")
        .select("*, users(first_name, last_name)")
        .eq("venue_id", venueId);
    return { data, error };
}

// Get user reviews
export async function getUserReviews(userId: string) {
    const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("user_id", userId);
    return { data, error };
}
