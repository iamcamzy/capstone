// GET /api/bookings/GetAllBookings — get all bookings with pagination (admin only)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const VALID_STATUSES = ["pending", "confirmed", "cancelled", "rescheduled"];

export const GET: APIRoute = async ({ cookies, url }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const page   = Math.max(1, parseInt(url.searchParams.get("page")  ?? "1"));
  const limit  = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20"));
  const status = url.searchParams.get("status");
  const offset = (page - 1) * limit;

  if (status && !VALID_STATUSES.includes(status)) {
    return error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  let query = db
    .from("bookings")
    .select(
      `id, user_id, venue_id, full_name, phone, pax,
       event_date, start_date, end_date, event_type, special_requests,
       status, total_price, created_at, updated_at,
       confirmed_at, cancelled_at, rescheduled_at`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status as "pending" | "confirmed" | "cancelled" | "rescheduled");

  const { data, error: dbError, count } = await query;
  if (dbError) {
    console.error("[GetAllBookings]", dbError.message);
    return error(dbError.message, 500);
  }

  return ok({
    bookings: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
};
