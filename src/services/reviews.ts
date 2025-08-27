import { supabase } from "../lib/supabase";

export async function addReview(
    userId: string,
    bookingId: string,
    rating: number,
    comment?: string
) {
    // Check if booking belongs to the user
    const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("id, user_id")
        .eq("id", bookingId)
        .single();

    if (bookingError) return { error: "Booking not found" };
    if (booking.user_id !== userId)
        return { error: "You can only review your own bookings" };

    // Insert review
    const { data, error } = await supabase
        .from("reviews")
        .insert([
            {
                booking_id: bookingId,
                user_id: userId,
                rating,
                comment,
            },
        ])
        .select();

    return { data, error };
}

// Get reviews for a venue (with pagination)
export async function getVenueReviews(
    venueId: string,
    page: number = 1,
    limit: number = 10
) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
        .from("reviews")
        .select(
            `
            id, rating, comment, created_at,
            bookings!inner(
                user_id,
                users(first_name, last_name)
            )
        `,
            { count: "exact" }
        )
        .eq("bookings.venue_id", venueId)
        .order("created_at", { ascending: false })
        .range(from, to);

    return { data, error, count, page, limit };
}

// Get reviews by a user (with pagination)
export async function getUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10
) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
        .from("reviews")
        .select(
            `
            id, rating, comment, created_at,
            bookings!inner(
                venue_id,
                venues(name)
            )
        `,
            { count: "exact" }
        )
        .eq("bookings.user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

    return { data, error, count, page, limit };
}
