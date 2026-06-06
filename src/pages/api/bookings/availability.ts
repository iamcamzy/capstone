// GET /api/bookings/availability — returns booked date ranges for the calendar (public)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { ok, error } from "../../../lib/response";

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

    // Fetch all non-cancelled bookings whose event_date or date range overlaps the month
    const { data, error: dbError } = await db
        .from("bookings")
        .select("id, start_date, end_date, event_date, status")
        .neq("status", "cancelled")
        .or(`event_date.gte.${startOfMonth},start_date.lte.${endOfMonth}`)
        .lte("start_date", endOfMonth)
        .gte("end_date", startOfMonth);

    if (dbError) {
        // Fallback: fetch without the complex filter
        const { data: fallback, error: err2 } = await db
            .from("bookings")
            .select("id, start_date, end_date, event_date, status")
            .neq("status", "cancelled")
            .gte("end_date", startOfMonth)
            .lte("start_date", endOfMonth);

        if (err2) return error(err2.message, 500);
        return ok({ bookings: fallback ?? [], year, month });
    }

    return ok({ bookings: data ?? [], year, month });
};
