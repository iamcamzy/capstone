// POST /api/auth/signup — register new account, auto sign-in, redirect to dashboard
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { signUpSchema } from "../../../validation/user";
import { error } from "../../../lib/response";
import { setSessionCookies } from "../../../lib/auth";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = signUpSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { email, password, firstName, lastName } = parsed.data;

  const { data: signUpData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName ?? null, last_name: lastName ?? null } },
  });

  if (authError) return error(authError.message, 400);

  // Auto sign-in after signup so cookies are set immediately
  if (signUpData.session) {
    setSessionCookies(cookies, signUpData.session.access_token, signUpData.session.refresh_token);
    return redirect("/dashboard");
  }

  // If email confirmation is required, session will be null
  return error("Account created. Please confirm your email before signing in.", 201);
};
