// GET /api/bookings/availability — returns booked date ranges for the calendar (public)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { ok, error } from "../../../lib/response";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

function formatDateOnly(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export const GET: APIRoute = async ({ url }) => {
    const year = parseInt(
        url.searchParams.get("year") ?? String(new Date().getFullYear()),
    );
    const month = parseInt(
        url.searchParams.get("month") ?? String(new Date().getMonth() + 1),
    ); // 1-12
    const venueId = url.searchParams.get("venueId");

    const startOfMonth = formatDateOnly(new Date(year, month - 1, 1));
    const endOfMonth = formatDateOnly(new Date(year, month, 0));

    // Only cancelled bookings free dates. Every other status blocks its date range.
    let query = db
        .from("bookings")
        .select("id, venue_id, start_date, end_date, event_date, status")
        .neq("status", "cancelled")
        .lte("start_date", endOfMonth)
        .gte("end_date", startOfMonth);

    if (venueId) {
        query = query.eq("venue_id", venueId);
    }

    let blockedDatesQuery = db
        .from("blocked_dates")
        .select("id, venue_id, start_date, end_date, reason, is_active")
        .eq("is_active", true)
        .lte("start_date", endOfMonth)
        .gte("end_date", startOfMonth);

    if (venueId) {
        blockedDatesQuery = blockedDatesQuery.eq("venue_id", venueId);
    }

    const [{ data, error: dbError }, { data: blockedDates, error: blockedDatesError }] =
        await Promise.all([query, blockedDatesQuery]);

    if (dbError) {
        return error(dbError.message, 500);
    }
    if (blockedDatesError) {
        return error(blockedDatesError.message, 500);
    }

    return ok({
        bookings: (data ?? []).map((booking) => ({
            ...booking,
            status: normalizeBookingStatus(booking.status),
        })),
        blockedDates: blockedDates ?? [],
        year,
        month,
    });
};
