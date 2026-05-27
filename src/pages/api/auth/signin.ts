// POST /api/auth/signin — sign in via form, sets cookies, redirects to /dashboard
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { setSessionCookies } from "../../../lib/auth";
import { signInSchema } from "../../../validation/user";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form  = await request.formData();
  const email    = form.get("email")?.toString().trim() ?? "";
  const password = form.get("password")?.toString() ?? "";

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message;
    return redirect(`/signin?error=${encodeURIComponent(msg)}`);
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.session) {
    const msg = error?.message ?? "Invalid credentials";
    return redirect(`/signin?error=${encodeURIComponent(msg)}`);
  }

  setSessionCookies(cookies, data.session.access_token, data.session.refresh_token);
  return redirect("/dashboard");
};
