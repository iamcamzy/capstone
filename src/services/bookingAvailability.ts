import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

type DbClient = SupabaseClient<Database>;

export type AvailabilityOverlapOptions = {
  venueId: string;
  startDate: string;
  endDate: string;
  excludeBookingId?: string;
};

export type AvailabilityRangeOptions = {
  venueId?: string | null;
  startDate: string;
  endDate: string;
};

export function applyDateRangeOverlap(query: any, startDate: string, endDate: string) {
  return query.lte("start_date", endDate).gte("end_date", startDate);
}

export async function findAvailabilityOverlaps(
  client: DbClient,
  { venueId, startDate, endDate, excludeBookingId }: AvailabilityOverlapOptions,
) {
  let bookingsQuery = applyDateRangeOverlap(
    client
      .from("bookings")
      .select("id")
      .eq("venue_id", venueId)
      .neq("status", "cancelled"),
    startDate,
    endDate,
  );

  if (excludeBookingId) {
    bookingsQuery = bookingsQuery.neq("id", excludeBookingId);
  }
  bookingsQuery = bookingsQuery.limit(1);

  const blockedDatesQuery = applyDateRangeOverlap(
    client
      .from("blocked_dates")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_active", true),
    startDate,
    endDate,
  ).limit(1);

  const [
    { data: bookings, error: bookingsError },
    { data: blockedDates, error: blockedDatesError },
  ] = await Promise.all([bookingsQuery, blockedDatesQuery]);

  return {
    bookings: bookings ?? [],
    blockedDates: blockedDates ?? [],
    error: bookingsError ?? blockedDatesError,
  };
}

export async function getAvailabilityRanges(
  client: DbClient,
  { venueId, startDate, endDate }: AvailabilityRangeOptions,
) {
  let bookingsQuery = applyDateRangeOverlap(
    client
      .from("bookings")
      .select("id, venue_id, start_date, end_date, event_date, status")
      .neq("status", "cancelled"),
    startDate,
    endDate,
  );

  let blockedDatesQuery = applyDateRangeOverlap(
    client
      .from("blocked_dates")
      .select("id, venue_id, start_date, end_date, reason, is_active")
      .eq("is_active", true),
    startDate,
    endDate,
  );

  if (venueId) {
    bookingsQuery = bookingsQuery.eq("venue_id", venueId);
    blockedDatesQuery = blockedDatesQuery.eq("venue_id", venueId);
  }

  const [
    { data: bookings, error: bookingsError },
    { data: blockedDates, error: blockedDatesError },
  ] = await Promise.all([bookingsQuery, blockedDatesQuery]);

  return {
    bookings: bookings ?? [],
    blockedDates: blockedDates ?? [],
    error: bookingsError ?? blockedDatesError,
  };
}
