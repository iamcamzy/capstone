import { supabase } from "../lib/supabase";

// User: get their bookings
export async function getUserBookings(userId: string) {
    return await supabase
        .from("bookings")
        .select(
            `
        start_date,
        end_date,
        event_type,
        created_at,
        status
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
            updated_at
        `
        )
        .order("created_at", { ascending: false });
}
