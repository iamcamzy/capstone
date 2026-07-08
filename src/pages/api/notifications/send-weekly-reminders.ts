// POST /api/notifications/send-weekly-reminders - send 1-week booking reminders
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import {
  notificationChannelSucceeded,
  notificationSucceeded,
  sendOneWeekReminder,
} from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

function dateSevenDaysFromToday(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
}

async function isAuthorized(request: Request, cookies: Parameters<typeof adminGuard>[0]) {
  const cronSecret = import.meta.env.NOTIFICATION_CRON_SECRET;
  if (!cronSecret) return adminGuard(cookies);

  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = url.searchParams.get("secret");

  if (bearer === cronSecret || headerSecret === cronSecret || querySecret === cronSecret) {
    return { user: null };
  }

  return error("Unauthorized", 401);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await isAuthorized(request, cookies);
  if (guard instanceof Response) return guard;

  const targetDate = dateSevenDaysFromToday();
  const { data: bookings, error: fetchError } = await db
    .from("bookings")
    .select("id, one_week_notice_sent_at")
    .eq("event_date", targetDate)
    .neq("status", "cancelled");

  if (fetchError) {
    console.error("[WeeklyReminders]", fetchError.message);
    return error(fetchError.message, 500);
  }

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ bookingId: string; error: string }> = [];

  for (const booking of bookings ?? []) {
    try {
      const result = await sendOneWeekReminder(booking.id, db);
      const emailSucceeded = notificationChannelSucceeded(result.email);
      const smsSucceeded = notificationChannelSucceeded(result.sms);
      const emailFailed = result.email && !result.email.ok ? result.email.error : null;
      const smsFailed = result.sms && !result.sms.ok ? result.sms.error : null;
      const failureMessage = [emailFailed, smsFailed].filter(Boolean).join("; ");
      const now = new Date().toISOString();
      const emailSent = !result.enabledChannels.email || Boolean(result.sentAt.email || emailSucceeded);
      const smsSent = !result.enabledChannels.sms || Boolean(result.sentAt.sms || smsSucceeded);
      const updates: {
        one_week_email_sent_at?: string;
        one_week_sms_sent_at?: string;
        one_week_notice_sent_at?: string;
      } = {};

      if (emailSucceeded) updates.one_week_email_sent_at = now;
      if (smsSucceeded) updates.one_week_sms_sent_at = now;
      if (emailSent && smsSent && !booking.one_week_notice_sent_at) {
        updates.one_week_notice_sent_at = now;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await db
          .from("bookings")
          .update(updates)
          .eq("id", booking.id);

        if (updateError) {
          failed.push({ bookingId: booking.id, error: updateError.message });
          continue;
        }
      }

      if (notificationSucceeded(result)) sent.push(booking.id);
      if (failureMessage) failed.push({ bookingId: booking.id, error: failureMessage });
      if (!notificationSucceeded(result) && !failureMessage) skipped.push(booking.id);
    } catch (reminderError) {
      failed.push({
        bookingId: booking.id,
        error: reminderError instanceof Error ? reminderError.message : "Reminder failed",
      });
    }
  }

  return ok({ targetDate, sent, skipped, failed });
};

