// POST /api/auth/signup — register a new account and require email verification
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { signUpSchema } from "../../../validation/user";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
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

  // Some Supabase projects return a session when email confirmation is disabled.
  // Discard it so signup never authenticates the customer implicitly.
  if (signUpData.session) await supabase.auth.signOut();
  const requiresEmailVerification = !signUpData.session && !signUpData.user?.email_confirmed_at;

  return created({
    message: requiresEmailVerification
      ? "Account created. Please verify your email before signing in."
      : "Account created. You can sign in now.",
    requiresEmailVerification,
  });
};
