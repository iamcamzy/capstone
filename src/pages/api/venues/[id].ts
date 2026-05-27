// GET /api/venues/:id — single venue (public) | PUT — update | DELETE — deactivate (admin)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { venueSchema } from "../../../validation/venue";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return error("Missing venue id", 400);

  const { data: venue, error: dbError } = await supabase
    .from("venues")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError || !venue) return error("Venue not found", 404);
  return ok({ venue });
};

export const PUT: APIRoute = async ({ request, cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const { id } = params;
  if (!id) return error("Missing venue id", 400);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = venueSchema.partial().safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { data: venue, error: dbError } = await supabase
    .from("venues")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return ok({ venue });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const { id } = params;
  if (!id) return error("Missing venue id", 400);

  const { error: dbError } = await supabase
    .from("venues")
    .update({ is_active: false })
    .eq("id", id);

  if (dbError) return error(dbError.message, 500);
  return ok({ message: "Venue deactivated successfully" });
};
