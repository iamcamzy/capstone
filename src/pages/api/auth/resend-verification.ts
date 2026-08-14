import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { parseBody } from "../../../lib/parseBody";
import { error, ok } from "../../../lib/response";
import { resendVerificationSchema } from "../../../validation/user";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = resendVerificationSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.errors[0].message, 400);

  const { error: resendError } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (resendError) return error(resendError.message, 400);

  return ok({
    message: "Verification email sent. Please check your inbox and spam folder.",
  });
};
