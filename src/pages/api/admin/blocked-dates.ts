// /api/admin/blocked-dates - manage admin blocked venue dates
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD");
const blockedDateReasonSchema = z
  .string({ required_error: "Blocked-date reason is required" })
  .trim()
  .min(1, "Blocked-date reason is required")
  .max(500, "Blocked-date reason must be 500 characters or fewer");

const createBlockedDateSchema = z
  .object({
    venueId: z.string().uuid("venueId must be a valid UUID"),
    startDate: dateString,
    endDate: dateString,
    reason: blockedDateReasonSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

const updateBlockedDateSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  venueId: z.string().uuid("venueId must be a valid UUID").optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  reason: blockedDateReasonSchema.optional(),
  isActive: z.boolean().optional(),
});

function mapBlockedDate(row: any) {
  return {
    id: row.id,
    venueId: row.venue_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const includeInactive = url.searchParams.get("includeInactive") === "true";
  let query = db
    .from("blocked_dates")
    .select("*")
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error: dbError } = await query;
  if (dbError) return error(dbError.message, 500);

  return ok({ blockedDates: (data ?? []).map(mapBlockedDate) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = createBlockedDateSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const { data, error: insertError } = await db
    .from("blocked_dates")
    .insert({
      venue_id: parsed.data.venueId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      reason: parsed.data.reason,
      created_by: guard.user.id,
      is_active: true,
    })
    .select("*")
    .single();

  if (insertError) return error(insertError.message, 500);
  return ok({ message: "Blocked date added", blockedDate: mapBlockedDate(data) });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = updateBlockedDateSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const { data: current, error: fetchError } = await db
    .from("blocked_dates")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !current) return error("Blocked date not found", 404);

  const nextStartDate = parsed.data.startDate ?? current.start_date;
  const nextEndDate = parsed.data.endDate ?? current.end_date;
  if (nextEndDate < nextStartDate) {
    return error("endDate must be on or after startDate", 400);
  }

  const updateData: Record<string, string | boolean> = {};
  if (parsed.data.venueId !== undefined) updateData.venue_id = parsed.data.venueId;
  if (parsed.data.startDate !== undefined) updateData.start_date = parsed.data.startDate;
  if (parsed.data.endDate !== undefined) updateData.end_date = parsed.data.endDate;
  if (parsed.data.reason !== undefined) updateData.reason = parsed.data.reason;
  if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;

  if (Object.keys(updateData).length === 0) {
    return ok({ message: "No changes", blockedDate: mapBlockedDate(current) });
  }

  const { data, error: updateError } = await db
    .from("blocked_dates")
    .update(updateData)
    .eq("id", parsed.data.id)
    .select("*")
    .single();

  if (updateError) return error(updateError.message, 500);
  return ok({ message: data.is_active ? "Blocked date updated" : "Blocked date deactivated", blockedDate: mapBlockedDate(data) });
};
