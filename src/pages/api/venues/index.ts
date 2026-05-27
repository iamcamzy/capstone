// GET /api/venues — list active venues (public) | POST — create venue (admin)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, created, error } from "../../../lib/response";
import { venueSchema } from "../../../validation/venue";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error: dbError } = await supabase
    .from("venues")
    .select("id, name, description, location, capacity, price_per_night, image_url, is_active")
    .eq("is_active", true)
    .order("name");

  if (dbError) return error(dbError.message, 500);
  return ok({ venues: data ?? [] });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = venueSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { data: venue, error: dbError } = await supabase
    .from("venues")
    .insert([{ ...parsed.data, is_active: true }])
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return created({ venue });
};
