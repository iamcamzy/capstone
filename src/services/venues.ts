import { supabase } from "../lib/supabase";

export async function getAllVenues() {
  return supabase
    .from("venues")
    .select("*")
    .eq("is_active", true)
    .order("name");
}

export async function getVenue(id: string) {
  return supabase.from("venues").select("*").eq("id", id).single();
}

export async function createVenue(venue: {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
  price_per_night: number;
  image_url?: string;
}) {
  return supabase.from("venues").insert([{ ...venue, is_active: true }]).select().single();
}

export async function updateVenue(id: string, updates: Record<string, unknown>) {
  return supabase.from("venues").update(updates).eq("id", id).select().single();
}

export async function deleteVenue(id: string) {
  // Soft delete
  return supabase.from("venues").update({ is_active: false }).eq("id", id);
}
