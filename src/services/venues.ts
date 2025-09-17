import { supabase } from "../lib/supabase";

// Get all venues
export async function getAllVenues() {
    const { data, error } = await supabase.from("venues").select("*");
    return { data, error };
}

// Get single venue
export async function getVenue(id: string) {
    const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", id)
        .single();
    return { data, error };
}

// Create venue (Owner only)
export async function createVenue(venue: any) {
    const { data, error } = await supabase
        .from("venues")
        .insert([venue])
        .select();
    return { data, error };
}

// Update venue
export async function updateVenue(id: string, updates: any) {
    const { data, error } = await supabase
        .from("venues")
        .update(updates)
        .eq("id", id)
        .select();
    return { data, error };
}

// Delete venue
export async function deleteVenue(id: string) {
    const { error } = await supabase.from("venues").delete().eq("id", id);
    return { error };
}
