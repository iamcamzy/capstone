// GET/POST /api/user/notification-preferences - manage current user's notification preferences
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { notificationPreferencesSchema } from "../../../validation/notificationPreferences";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized - please sign in", 401);

  const { data: profile, error: dbError } = await db
    .from("customers")
    .select("email_notifications_enabled, sms_notifications_enabled")
    .eq("id", user.id)
    .single();

  if (dbError || !profile) return error("Customer profile not found", 404);

  return ok({
    emailNotificationsEnabled: profile.email_notifications_enabled,
    smsNotificationsEnabled: profile.sms_notifications_enabled,
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized - please sign in", 401);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = notificationPreferencesSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const { data: profile, error: dbError } = await db
    .from("customers")
    .update({
      email_notifications_enabled: parsed.data.emailNotificationsEnabled,
      sms_notifications_enabled: parsed.data.smsNotificationsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("email_notifications_enabled, sms_notifications_enabled")
    .single();

  if (dbError || !profile) {
    console.error("[NotificationPreferences]", dbError?.message);
    return error(dbError?.message ?? "Customer profile not found", dbError ? 500 : 404);
  }

  return ok({
    emailNotificationsEnabled: profile.email_notifications_enabled,
    smsNotificationsEnabled: profile.sms_notifications_enabled,
  });
};

