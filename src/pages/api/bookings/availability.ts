// GET /api/bookings/availability — returns booked date ranges for the calendar (public)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { ok, error } from "../../../lib/response";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ url }) => {
    const year = parseInt(
        url.searchParams.get("year") ?? String(new Date().getFullYear()),
    );
    const month = parseInt(
        url.searchParams.get("month") ?? String(new Date().getMonth() + 1),
    ); // 1-12

    const startOfMonth = new Date(year, month - 1, 1)
        .toISOString()
        .split("T")[0];
    const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];

    // Only cancelled bookings free dates. Every other status blocks its date range.
    const { data, error: dbError } = await db
        .from("bookings")
        .select("id, start_date, end_date, event_date, status")
        .neq("status", "cancelled")
        .lte("start_date", endOfMonth)
        .gte("end_date", startOfMonth);

    if (dbError) {
        return error(dbError.message, 500);
    }

    return ok({
        bookings: (data ?? []).map((booking) => ({
            ...booking,
            status: normalizeBookingStatus(booking.status),
        })),
        year,
        month,
    });
};
