import { normalizeBookingStatus, type BookingStatus } from "../lib/bookingStatus";

export type SalesReportPeriod = "weekly" | "monthly";

export interface SalesReportBooking {
  id: string;
  status: string | null;
  created_at: string;
  event_date: string | null;
  start_date: string;
  total_price: number | null;
  package_id: string | null;
  package_type: string | null;
}

export interface SalesReportPayment {
  booking_id: string;
  total_booking_amount: number;
  amount_paid: number;
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
}

export interface SalesReportPackageMetric {
  packageId: string | null;
  packageName: string;
  bookingCount: number;
  revenue: number;
}

export interface SalesReport {
  period: { type: SalesReportPeriod; start: string; endExclusive: string };
  totalBookings: number;
  bookedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  rescheduledBookings: number;
  contractSigningBookings: number;
  grossRevenue: number;
  paidRevenue: number;
  unpaidBalance: number;
  cancellationCount: number;
  cancellationRate: number;
  cancelledBookingValue: number;
  retainedCancellationRevenue: number;
  revenueByPackage: SalesReportPackageMetric[];
  bookingCountByPackage: SalesReportPackageMetric[];
  averageBookingValue: number;
  busiestBookingDates: Array<{ date: string; bookingCount: number }>;
  mostSelectedPackages: SalesReportPackageMetric[];
}

export interface SalesForecast {
  available: boolean;
  message: string | null;
  targetMonth: string;
  expectedBookings: number | null;
  expectedRevenue: number | null;
  likelyTopPackage: string | null;
  monthsUsed: string[];
  method: "3-month moving average with monthly trend average";
}

const PACKAGE_LABELS: Record<string, string> = {
  "lunch-time": "Lunch Time Package",
  "dinner-time": "Dinner Time Package",
  "barkada-staycation": "Barkada Staycation",
  "pamilya-staycation": "Pamilya Staycation",
  "room-rates": "Room Rates",
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const FORECAST_UNAVAILABLE_MESSAGE = "Not enough reliable historical data for forecasting yet.";

/**
 * Produces a basic estimate from the latest three complete calendar months.
 * Only booked/completed reservations count as reliable history. The result
 * averages a 3-month moving average with the average month-to-month trend.
 */
export function calculateSalesForecast(
  bookings: SalesReportBooking[],
  payments: SalesReportPayment[],
  targetMonth: string,
  packageNames: Record<string, string> = {},
): SalesForecast {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) throw new Error("Target month must use YYYY-MM format");

  const paymentByBooking = new Map(payments.map((payment) => [payment.booking_id, payment]));
  const reliable = bookings.filter((booking) => {
    const status = normalizeBookingStatus(booking.status);
    return (status === "booked" || status === "completed") && booking.created_at.slice(0, 7) < targetMonth;
  });
  const reliableMonths = [...new Set(reliable.map((booking) => booking.created_at.slice(0, 7)))].sort();
  const monthsUsed = reliableMonths.slice(-3);

  if (monthsUsed.length < 3) {
    return {
      available: false,
      message: FORECAST_UNAVAILABLE_MESSAGE,
      targetMonth,
      expectedBookings: null,
      expectedRevenue: null,
      likelyTopPackage: null,
      monthsUsed,
      method: "3-month moving average with monthly trend average",
    };
  }

  const histories = monthsUsed.map((month) => {
    const monthBookings = reliable.filter((booking) => booking.created_at.startsWith(month));
    const revenue = monthBookings.reduce((sum, booking) => {
      const payment = paymentByBooking.get(booking.id);
      return sum + Math.max(Number(payment?.total_booking_amount ?? booking.total_price ?? 0), 0);
    }, 0);
    return { bookings: monthBookings.length, revenue };
  });
  const movingAverage = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const averageTrend = (values: number[]) =>
    values.slice(1).reduce((sum, value, index) => sum + (value - values[index]), 0) / (values.length - 1);
  const forecastValue = (values: number[]) => Math.max(0, (movingAverage(values) + values.at(-1)! + averageTrend(values)) / 2);

  const packageCounts = new Map<string, { name: string; count: number }>();
  reliable.filter((booking) => monthsUsed.includes(booking.created_at.slice(0, 7))).forEach((booking) => {
    const key = booking.package_id ?? booking.package_type ?? "unspecified";
    const name = booking.package_id
      ? (packageNames[booking.package_id] ?? booking.package_type ?? "Unspecified package")
      : (PACKAGE_LABELS[booking.package_type ?? ""] ?? booking.package_type ?? "Unspecified package");
    const current = packageCounts.get(key) ?? { name, count: 0 };
    current.count++;
    packageCounts.set(key, current);
  });
  const likelyTopPackage = [...packageCounts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))[0]?.name ?? "Unspecified package";

  return {
    available: true,
    message: null,
    targetMonth,
    expectedBookings: Math.round(forecastValue(histories.map((item) => item.bookings))),
    expectedRevenue: roundMoney(forecastValue(histories.map((item) => item.revenue))),
    likelyTopPackage,
    monthsUsed,
    method: "3-month moving average with monthly trend average",
  };
}

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Date must use YYYY-MM-DD format");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("Date is invalid");
  return date;
}

/** Returns a half-open UTC range, avoiding end-of-day millisecond edge cases. */
export function getSalesReportRange(period: SalesReportPeriod, anchor: string) {
  if (period === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(anchor)) throw new Error("Month must use YYYY-MM format");
    const start = parseDateOnly(`${anchor}-01`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { type: period, start: start.toISOString(), endExclusive: end.toISOString() };
  }

  const selected = parseDateOnly(anchor);
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() - ((selected.getUTCDay() + 6) % 7));
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + 7);
  return { type: period, start: monday.toISOString(), endExclusive: end.toISOString() };
}

export function calculateSalesReport(
  bookings: SalesReportBooking[],
  payments: SalesReportPayment[],
  period: SalesReport["period"],
  packageNames: Record<string, string> = {},
): SalesReport {
  const paymentByBooking = new Map(payments.map((payment) => [payment.booking_id, payment]));
  const statusCounts: Record<BookingStatus, number> = {
    contract_signing: 0, booked: 0, rescheduled: 0, cancelled: 0, completed: 0,
  };
  const packages = new Map<string, SalesReportPackageMetric>();
  const dates = new Map<string, number>();
  let grossRevenue = 0;
  let paidRevenue = 0;
  let unpaidBalance = 0;
  let revenueBookingCount = 0;
  let cancelledBookingValue = 0;
  let retainedCancellationRevenue = 0;

  for (const booking of bookings) {
    const status = normalizeBookingStatus(booking.status);
    statusCounts[status]++;
    const payment = paymentByBooking.get(booking.id);
    const paid = payment?.payment_status === "refunded" ? 0 : Math.max(Number(payment?.amount_paid ?? 0), 0);
    const total = Math.max(Number(payment?.total_booking_amount ?? booking.total_price ?? 0), 0);
    const isExpectedRevenue = status === "booked" || status === "completed";
    const retainedCancellation = status === "cancelled" ? paid : 0;
    const recognizedGross = isExpectedRevenue ? total : retainedCancellation;

    grossRevenue += recognizedGross;
    paidRevenue += paid;
    unpaidBalance += isExpectedRevenue ? Math.max(total - paid, 0) : 0;
    if (recognizedGross > 0) revenueBookingCount++;
    if (status === "cancelled") {
      cancelledBookingValue += total;
      retainedCancellationRevenue += retainedCancellation;
    }

    const packageKey = booking.package_id ?? booking.package_type ?? "unspecified";
    const packageName = booking.package_id
      ? (packageNames[booking.package_id] ?? booking.package_type ?? "Unspecified package")
      : (PACKAGE_LABELS[booking.package_type ?? ""] ?? booking.package_type ?? "Unspecified package");
    const packageMetric = packages.get(packageKey) ?? {
      packageId: booking.package_id,
      packageName,
      bookingCount: 0,
      revenue: 0,
    };
    packageMetric.bookingCount++;
    packageMetric.revenue += recognizedGross;
    packages.set(packageKey, packageMetric);

    if (status !== "cancelled") {
      const date = (booking.event_date ?? booking.start_date).slice(0, 10);
      dates.set(date, (dates.get(date) ?? 0) + 1);
    }
  }

  const packageMetrics = [...packages.values()].map((item) => ({ ...item, revenue: roundMoney(item.revenue) }));
  const byCount = [...packageMetrics].sort((a, b) => b.bookingCount - a.bookingCount || a.packageName.localeCompare(b.packageName));

  return {
    period,
    totalBookings: bookings.length,
    bookedBookings: statusCounts.booked,
    completedBookings: statusCounts.completed,
    cancelledBookings: statusCounts.cancelled,
    rescheduledBookings: statusCounts.rescheduled,
    contractSigningBookings: statusCounts.contract_signing,
    grossRevenue: roundMoney(grossRevenue),
    paidRevenue: roundMoney(paidRevenue),
    unpaidBalance: roundMoney(unpaidBalance),
    cancellationCount: statusCounts.cancelled,
    cancellationRate: bookings.length ? roundMoney((statusCounts.cancelled / bookings.length) * 100) : 0,
    cancelledBookingValue: roundMoney(cancelledBookingValue),
    retainedCancellationRevenue: roundMoney(retainedCancellationRevenue),
    revenueByPackage: [...packageMetrics].sort((a, b) => b.revenue - a.revenue || a.packageName.localeCompare(b.packageName)),
    bookingCountByPackage: byCount,
    averageBookingValue: revenueBookingCount ? roundMoney(grossRevenue / revenueBookingCount) : 0,
    busiestBookingDates: [...dates.entries()]
      .map(([date, bookingCount]) => ({ date, bookingCount }))
      .sort((a, b) => b.bookingCount - a.bookingCount || a.date.localeCompare(b.date)),
    mostSelectedPackages: byCount.filter((item) => item.bookingCount === (byCount[0]?.bookingCount ?? 0)),
  };
}
