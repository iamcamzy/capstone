import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { clearSessionCookies, getSafeInternalRedirect, isEmailVerified, setSessionCookies } from "../../../lib/auth";
import { getDashboardPathForRole, getUserRole } from "../../../lib/adminGuard";
import { signInSchema } from "../../../validation/user";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = form.get("email")?.toString().trim() ?? "";
  const password = form.get("password")?.toString() ?? "";
  const redirectPath = getSafeInternalRedirect(form.get("redirect")?.toString());
  const redirectQuery = `&redirect=${encodeURIComponent(redirectPath)}`;

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    const msg = parsed.error.errors[0].message;
    return redirect(`/signin?error=${encodeURIComponent(msg)}${redirectQuery}`);
  }

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.session) {
    if (error?.message.toLowerCase().includes("email not confirmed")) {
      clearSessionCookies(cookies);
      return redirect(`/signin?unverified=1&email=${encodeURIComponent(parsed.data.email)}${redirectQuery}`);
    }
    const msg = error?.message ?? "Invalid credentials";
    return redirect(`/signin?error=${encodeURIComponent(msg)}${redirectQuery}`);
  }

  if (!data.user || !isEmailVerified(data.user)) {
    await supabase.auth.signOut();
    clearSessionCookies(cookies);
    return redirect(`/signin?unverified=1&email=${encodeURIComponent(parsed.data.email)}${redirectQuery}`);
  }

  setSessionCookies(cookies, data.session.access_token, data.session.refresh_token);
  const roleInfo = await getUserRole(cookies);
  if (roleInfo.role === "none") {
    await supabase.auth.signOut();
    clearSessionCookies(cookies);
    return redirect("/signin?error=This+account+is+inactive+or+has+no+assigned+role");
  }
  const destination = redirectPath === "/dashboard"
    ? getDashboardPathForRole(roleInfo.role)
    : redirectPath;
  return redirect(destination);
};
