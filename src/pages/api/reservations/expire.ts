// POST /api/reservations/expire - cancel expired unpaid reservations
import type { APIRoute } from "astro";
import { adminGuard } from "../../../lib/adminGuard";
import { error, ok } from "../../../lib/response";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { expireUnpaidReservations } from "../../../services/reservationExpiration";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

async function isAuthorized(request: Request, cookies: Parameters<typeof adminGuard>[0]) {
  const cronSecret =
    import.meta.env.RESERVATION_CRON_SECRET ?? import.meta.env.NOTIFICATION_CRON_SECRET;
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

  try {
    const result = await expireUnpaidReservations(db);
    return ok({
      count: result.count,
      expiredReservations: result.count,
      bookingIds: result.bookingIds,
      remindersSent: result.remindersSent,
      cancellationNoticesSent: result.cancellationNoticesSent,
      notificationFailures: result.notificationFailures,
    });
  } catch (expirationError) {
    const technicalMessage =
      expirationError instanceof Error
        ? expirationError.message
        : "Reservation expiration failed";
    console.error("[ReservationExpiration]", technicalMessage);
    return error("Reservation expiration could not be completed", 500);
  }
};
