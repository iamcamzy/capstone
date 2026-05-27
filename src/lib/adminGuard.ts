// adminGuard.ts — protects admin-only routes
import type { AstroCookies } from "astro";
import { supabaseAdmin, supabase } from "./supabase";
import { getUser } from "./auth";
import { error } from "./response";

const db = supabaseAdmin ?? supabase;

export async function adminGuard(
  cookies: AstroCookies
): Promise<{ user: Awaited<ReturnType<typeof getUser>> & {} } | Response> {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized", 401);

  // Admin check: exists in admins table
  const { data } = await db.from("admins").select("id").eq("id", user.id).single();
  if (!data) return error("Forbidden: admins only", 403);

  return { user };
}
