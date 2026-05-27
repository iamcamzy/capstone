// PUT /api/packages/:id — update package | DELETE — deactivate (admin)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { packageSchema } from "../../../validation/package";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const PUT: APIRoute = async ({ request, cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const { id } = params;
  if (!id) return error("Missing package id", 400);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = packageSchema.partial().safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { data: pkg, error: dbError } = await supabase
    .from("packages")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return ok({ package: pkg });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const { id } = params;
  if (!id) return error("Missing package id", 400);

  const { error: dbError } = await supabase
    .from("packages")
    .update({ is_active: false })
    .eq("id", id);

  if (dbError) return error(dbError.message, 500);
  return ok({ message: "Package deactivated successfully" });
};
