// POST /api/auth/signout — clear cookies and redirect to /signin
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { clearSessionCookies } from "../../../lib/auth";

export const prerender = false;

// POST is correct — GET signout is a CSRF logout vulnerability
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await supabase.auth.signOut().catch(() => {});
  clearSessionCookies(cookies);
  return redirect("/signin");
};

// Keep GET as a safe fallback redirect only (no signout logic)
export const GET: APIRoute = async ({ redirect }) => {
  return redirect("/signin");
};
