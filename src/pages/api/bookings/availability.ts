// GET /api/bookings/availability — returns booked date ranges for the calendar (public)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { ok, error } from "../../../lib/response";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";
import {
    ADVANCE_BOOKING_DAYS,
    getMinimumBookingDateValue,
    formatDateOnly,
} from "../../../lib/bookingDateRules";
import { getAvailabilityRanges } from "../../../services/bookingAvailability";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ url }) => {
    const requestedYear = parseInt(
        url.searchParams.get("year") ?? String(new Date().getFullYear()),
    );
    const requestedMonth = parseInt(
        url.searchParams.get("month") ?? String(new Date().getMonth() + 1),
    ); // 1-12
    const today = new Date();
    const year = Number.isFinite(requestedYear) ? requestedYear : today.getFullYear();
    const month =
        Number.isFinite(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
            ? requestedMonth
            : today.getMonth() + 1;
    const venueId = url.searchParams.get("venueId")?.trim() || null;

    const startOfMonth = formatDateOnly(new Date(year, month - 1, 1));
    const endOfMonth = formatDateOnly(new Date(year, month, 0));

    const availability = await getAvailabilityRanges(db, {
        venueId,
        startDate: startOfMonth,
        endDate: endOfMonth,
    });

    if (availability.error) {
        return error(availability.error.message, 500);
    }

    return ok({
        bookings: availability.bookings.map((booking: { status: string; [key: string]: unknown }) => ({
            ...booking,
            status: normalizeBookingStatus(booking.status),
        })),
        blockedDates: availability.blockedDates,
        minimumBookingDate: getMinimumBookingDateValue(),
        advanceBookingDays: ADVANCE_BOOKING_DAYS,
        year,
        month,
        venueId,
    });
};
