import { supabase } from "../lib/supabase";

// User: make booking
export async function createBooking(booking: any) {
    const { data, error } = await supabase
        .from("bookings")
        .insert([booking])
        .select();
    return { data, error };
}

// User: get their bookings
export async function getUserBookings(userId: string) {
    const { data, error } = await supabase
        .from("bookings")
        .select("*, venues(*)")
        .eq("user_id", userId);
    return { data, error };
}

// Owner/Admin: get all bookings
export async function getAllBookings() {
    const { data, error } = await supabase
        .from("bookings")
        .select("*, users(*), venues(*)");
    return { data, error };
}

// Update booking status (owner/admin)
export async function updateBookingStatus(id: string, status: string) {
    const { data, error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id)
        .select();
    return { data, error };
}

// Cancel booking (user)
export async function cancelBooking(id: string) {
    const { data, error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select();
    return { data, error };
}
