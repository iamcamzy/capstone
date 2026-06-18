// GET /api/admin/stats — dashboard statistics (admin only)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok } from "../../../lib/response";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const [
    { count: total },
    { count: booked },
    { count: contractSigning },
    { count: completed },
    { count: cancelled },
    { count: rescheduled },
    { count: thisMonth },
    { data: revenue },
    { count: activeVenues },
    { count: totalUsers },
    { data: paxData },
  ] = await Promise.all([
    db.from("bookings").select("*", { count: "exact", head: true }),
    db.from("bookings").select("*", { count: "exact", head: true }).eq("status", "booked"),
    db.from("bookings").select("*", { count: "exact", head: true }).eq("status", "contract_signing"),
    db.from("bookings").select("*", { count: "exact", head: true }).eq("status", "completed"),
    db.from("bookings").select("*", { count: "exact", head: true }).eq("status", "cancelled"),
    db.from("bookings").select("*", { count: "exact", head: true }).eq("status", "rescheduled"),
    db.from("bookings").select("*", { count: "exact", head: true })
      .gte("created_at", monthStart).lte("created_at", monthEnd),
    db.from("bookings").select("total_price").in("status", ["booked", "completed"]),
    db.from("venues").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("customers").select("*", { count: "exact", head: true }),
    db.from("bookings").select("pax").in("status", ["booked", "completed"]).not("pax", "is", null),
  ]);

  const totalRevenue = (revenue ?? []).reduce((s, b) => s + Number(b.total_price ?? 0), 0);
  const avgPax = paxData && paxData.length > 0
    ? Math.round(paxData.reduce((s, b) => s + (b.pax ?? 0), 0) / paxData.length)
    : 0;

  return ok({
    bookings: { total, booked, contractSigning, cancelled, rescheduled, completed, thisMonth },
    revenue:   { total: totalRevenue },
    venues:    { active: activeVenues ?? 0 },
    users:     { total: totalUsers ?? 0 },
    avgPax,
  });
};
