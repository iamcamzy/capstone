// POST /api/admin/users - manage admin and staff roles
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const VALID_ACTIONS = ["promote", "demote", "promote_staff", "demote_staff"] as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{ userId?: string; action?: string }>(request);
  if (!body.ok) return body.response;

  const { userId, action } = body.data;
  if (!userId) return error("userId is required", 400);
  if (!action || !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return error(`action must be one of: ${VALID_ACTIONS.join(", ")}`, 400);
  }

  if (action === "promote") {
    const { data: customer } = await db
      .from("customers")
      .select("id, email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!customer) return error("Customer not found", 404);

    const { error: insertErr } = await db.from("admins").insert({
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
    });
    if (insertErr) return error(insertErr.message, 500);

    await db.from("employees").update({ is_active: false }).eq("id", userId);
    await db.from("customers").delete().eq("id", userId);
    return ok({ message: "User promoted to admin" });
  }

  if (action === "promote_staff") {
    const { data: customer } = await db
      .from("customers")
      .select("id, email, first_name, last_name, phone")
      .eq("id", userId)
      .single();

    if (!customer) return error("Customer not found", 404);

    const { error: insertErr } = await db.from("employees").upsert({
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      position: "Staff",
      is_active: true,
      created_by: guard.user.id,
    });
    if (insertErr) return error(insertErr.message, 500);

    await db.from("customers").delete().eq("id", userId);
    return ok({ message: "User promoted to staff" });
  }

  if (action === "demote_staff") {
    const { data: employee } = await db
      .from("employees")
      .select("id, email, first_name, last_name, phone")
      .eq("id", userId)
      .single();

    if (!employee) return error("Staff member not found", 404);

    const { error: insertErr } = await db.from("customers").upsert({
      id: employee.id,
      email: employee.email,
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone,
    });
    if (insertErr) return error(insertErr.message, 500);

    await db.from("employees").update({ is_active: false }).eq("id", userId);
    return ok({ message: "Staff member demoted to customer" });
  }

  const { data: admin } = await db
    .from("admins")
    .select("id, email, first_name, last_name")
    .eq("id", userId)
    .single();

  if (!admin) return error("Admin not found", 404);

  if (userId === guard.user.id) {
    return error("You cannot demote yourself", 400);
  }

  const { error: insertErr } = await db.from("customers").upsert({
    id: admin.id,
    email: admin.email,
    first_name: admin.first_name,
    last_name: admin.last_name,
  });
  if (insertErr) return error(insertErr.message, 500);

  await db.from("admins").delete().eq("id", userId);
  return ok({ message: "Admin demoted to customer" });
};
