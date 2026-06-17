// POST /api/notifications/send-weekly-reminders - send 1-week booking reminders
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { notificationSucceeded, sendOneWeekReminder } from "../../../services/notifications";

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
    .select("id")
    .eq("event_date", targetDate)
    .neq("status", "cancelled")
    .is("one_week_notice_sent_at", null);

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
      if (!notificationSucceeded(result)) {
        skipped.push(booking.id);
        continue;
      }

      const { error: updateError } = await db
        .from("bookings")
        .update({ one_week_notice_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      if (updateError) {
        failed.push({ bookingId: booking.id, error: updateError.message });
        continue;
      }

      sent.push(booking.id);
    } catch (reminderError) {
      failed.push({
        bookingId: booking.id,
        error: reminderError instanceof Error ? reminderError.message : "Reminder failed",
      });
    }
  }

  return ok({ targetDate, sent, skipped, failed });
};

