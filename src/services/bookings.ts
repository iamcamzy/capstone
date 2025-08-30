import { supabase } from "../lib/supabase";

// Make booking (User)
export async function createBooking(booking: any) {
    const { data, error } = await supabase
        .from("bookings")
        .insert([booking])
        .select();
    return { data, error };
}

// User: get their bookings
export async function getUserBookings(userId: string) {
    return await supabase
        .from("bookings")
        .select(
            `
        id,
        user_id,
        venue_id,
        start_date,
        end_date,
        event_type,
        status,
        created_at,
        updated_at,
        venues
        `
        )
        .eq("user_id", userId);
}

// Owner/Admin: get all bookings
export async function getAllBookings() {
    return await supabase
        .from("bookings")
        .select(
            `
            id,
            user_id,
            venue_id,
            start_date,
            end_date,
            event_type,
            status,
            created_at,
            updated_at,
            users ( email ),
            venues ( name, location )
        `
        )
        .order("created_at", { ascending: false });
}

// Update booking status (owner)
export async function confirmBooking(bookingId: string, userId: string) {
    return await supabase.rpc("confirm_booking", {
        p_booking_id: bookingId,
        p_user_id: userId,
    });
}

// Cancel booking (user)
export async function cancelBooking(bookingId: string, userId: string) {
    return await supabase.rpc("cancel_booking", {
        p_booking_id: bookingId,
        p_user_id: userId,
    });
}
