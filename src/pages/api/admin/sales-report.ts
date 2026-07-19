import type { APIRoute } from "astro";
import { adminGuard } from "../../../lib/adminGuard";
import { error, ok } from "../../../lib/response";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { calculateSalesForecast, calculateSalesReport, getSalesReportRange, type SalesReportPeriod } from "../../../services/salesReports";

export const prerender = false;
const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ cookies, url }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const period = url.searchParams.get("period") as SalesReportPeriod | null;
  const anchor = url.searchParams.get("anchor");
  if ((period !== "weekly" && period !== "monthly") || !anchor) {
    return error("period must be weekly or monthly, and anchor is required", 400);
  }

  let range;
  try {
    range = getSalesReportRange(period, anchor);
  } catch (rangeError) {
    return error(rangeError instanceof Error ? rangeError.message : "Invalid report range", 400);
  }

  const { data: bookings, error: bookingsError } = await db
    .from("bookings")
    .select("id, full_name, status, created_at, event_date, start_date, total_price, package_id, package_type, venue_id, pax")
    .gte("created_at", range.start)
    .lt("created_at", range.endExclusive)
    .order("created_at", { ascending: true });
  if (bookingsError) {
    console.error("[SalesReport] bookings:", bookingsError.message);
    return error("Could not load report bookings", 500);
  }

  const bookingIds = (bookings ?? []).map((booking) => booking.id);
  const packageIds = [...new Set((bookings ?? []).map((booking) => booking.package_id).filter((id): id is string => Boolean(id)))];
  const venueIds = [...new Set((bookings ?? []).map((booking) => booking.venue_id).filter((id): id is string => Boolean(id)))];
  const [{ data: payments, error: paymentsError }, { data: packages, error: packagesError }, { data: venues, error: venuesError }] = await Promise.all([
    bookingIds.length
      ? db.from("booking_payments").select("booking_id, total_booking_amount, amount_paid, payment_status").in("booking_id", bookingIds)
      : Promise.resolve({ data: [], error: null }),
    packageIds.length
      ? db.from("packages").select("id, name").in("id", packageIds)
      : Promise.resolve({ data: [], error: null }),
    venueIds.length
      ? db.from("venues").select("id, name").in("id", venueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentsError || packagesError || venuesError) {
    console.error("[SalesReport] related data:", paymentsError?.message ?? packagesError?.message ?? venuesError?.message);
    return error("Could not load report payment or package data", 500);
  }

  const packageNames = Object.fromEntries((packages ?? []).map((item) => [item.id, item.name]));
  const venueNames = Object.fromEntries((venues ?? []).map((item) => [item.id, item.name]));
  const paymentByBooking = Object.fromEntries((payments ?? []).map((item) => [item.booking_id, item]));
  const reportBookings = (bookings ?? []).map((booking) => ({
    ...booking,
    venueName: booking.venue_id ? (venueNames[booking.venue_id] ?? "Unspecified venue") : "Unspecified venue",
    packageName: booking.package_id
      ? (packageNames[booking.package_id] ?? booking.package_type ?? "Unspecified package")
      : (booking.package_type ?? "Unspecified package"),
    payment: paymentByBooking[booking.id] ?? null,
  }));
  const now = new Date();
  const targetMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const targetMonth = targetMonthDate.toISOString().slice(0, 7);
  const historyEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data: forecastBookings, error: forecastBookingsError } = await db
    .from("bookings")
    .select("id, status, created_at, event_date, start_date, total_price, package_id, package_type")
    .in("status", ["booked", "completed", "confirmed"])
    .lt("created_at", historyEnd)
    .order("created_at", { ascending: true });
  if (forecastBookingsError) {
    console.error("[SalesForecast] bookings:", forecastBookingsError.message);
    return error("Could not load forecasting history", 500);
  }

  const forecastBookingIds = (forecastBookings ?? []).map((booking) => booking.id);
  const forecastPackageIds = [...new Set((forecastBookings ?? []).map((booking) => booking.package_id).filter((id): id is string => Boolean(id)))];
  const [{ data: forecastPayments, error: forecastPaymentsError }, { data: forecastPackages, error: forecastPackagesError }] = await Promise.all([
    forecastBookingIds.length
      ? db.from("booking_payments").select("booking_id, total_booking_amount, amount_paid, payment_status").in("booking_id", forecastBookingIds)
      : Promise.resolve({ data: [], error: null }),
    forecastPackageIds.length
      ? db.from("packages").select("id, name").in("id", forecastPackageIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (forecastPaymentsError || forecastPackagesError) {
    console.error("[SalesForecast] related data:", forecastPaymentsError?.message ?? forecastPackagesError?.message);
    return error("Could not load forecasting details", 500);
  }
  const forecastPackageNames = Object.fromEntries((forecastPackages ?? []).map((item) => [item.id, item.name]));
  const forecast = calculateSalesForecast(forecastBookings ?? [], forecastPayments ?? [], targetMonth, forecastPackageNames);

  return ok({ report: calculateSalesReport(bookings ?? [], payments ?? [], range, packageNames), bookings: reportBookings, forecast });
};
