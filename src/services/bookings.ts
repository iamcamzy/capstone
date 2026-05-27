import { supabase } from "../lib/supabase";

export async function getUserBookings(userId: string) {
  return supabase
    .from("bookings")
    .select(
      `id, start_date, end_date, event_type, guests, status,
       total_price, special_requests, created_at,
       venue:venues(id, name, image_url, price_per_night)`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function getAllBookings() {
  return supabase
    .from("bookings")
    .select(
      `id, user_id, venue_id, start_date, end_date, event_type, guests,
       status, total_price, full_name, phone, created_at, updated_at,
       venue:venues(id, name), user:users(first_name, last_name, email)`
    )
    .order("created_at", { ascending: false });
}

export async function getBookingById(id: string) {
  return supabase
    .from("bookings")
    .select(`*, venue:venues(*), user:users(*)`)
    .eq("id", id)
    .single();
}
