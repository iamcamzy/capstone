// GET /api/packages — list active packages (public) | POST — create package (admin)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, created, error } from "../../../lib/response";
import { packageSchema } from "../../../validation/package";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const GET: APIRoute = async () => {
  const { data, error: dbError } = await supabase
    .from("packages")
    .select("id, name, description, price, inclusions, max_pax, is_active")
    .eq("is_active", true)
    .order("price");

  if (dbError) return error(dbError.message, 500);
  return ok({ packages: data ?? [] });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = packageSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { data: pkg, error: dbError } = await supabase
    .from("packages")
    .insert([parsed.data])
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return created({ package: pkg });
};
