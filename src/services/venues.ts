import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type VenueInsert = Database["public"]["Tables"]["venues"]["Insert"];
type VenueUpdate = Database["public"]["Tables"]["venues"]["Update"];

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

export async function createVenue(venue: Omit<VenueInsert, "id" | "created_at" | "updated_at" | "is_active">) {
  return supabase.from("venues").insert([{ ...venue, is_active: true }]).select().single();
}

export async function updateVenue(id: string, updates: VenueUpdate) {
  return supabase.from("venues").update(updates).eq("id", id).select().single();
}

export async function deleteVenue(id: string) {
  // Soft delete
  return supabase.from("venues").update({ is_active: false }).eq("id", id);
}
