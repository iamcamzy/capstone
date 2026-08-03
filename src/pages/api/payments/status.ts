import type { APIRoute } from "astro";
import { getUser } from "../../../lib/auth";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { error, ok } from "../../../lib/response";
export const prerender = false;
const db = supabaseAdmin ?? supabase;
export const GET: APIRoute = async ({ url, cookies }) => {
  const user = await getUser(cookies); if (!user) return error("Unauthorized", 401);
  const bookingId = url.searchParams.get("bookingId"); if (!bookingId) return error("bookingId is required", 400);
  const { data } = await db.from("payment_transactions").select("status,amount,payment_method,reference_number,paid_at,failure_reason")
    .eq("booking_id", bookingId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return ok({ payment: data ?? null });
};
