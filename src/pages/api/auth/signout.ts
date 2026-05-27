// GET /api/auth/signout — clear cookies, redirect to /signin
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { clearSessionCookies } from "../../../lib/auth";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  await supabase.auth.signOut().catch(() => {});
  clearSessionCookies(cookies);
  return redirect("/signin");
};
