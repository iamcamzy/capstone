// POST /api/admin/users — promote customer to admin or demote admin to customer
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{ userId?: string; action?: string }>(request);
  if (!body.ok) return body.response;

  const { userId, action } = body.data;
  if (!userId) return error("userId is required", 400);
  if (!action || !["promote", "demote"].includes(action)) {
    return error('action must be "promote" (customer → admin) or "demote" (admin → customer)', 400);
  }

  if (action === "promote") {
    // Move from customers → admins
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

    await db.from("customers").delete().eq("id", userId);
    return ok({ message: "User promoted to admin" });
  }

  // demote: move from admins → customers
  const { data: admin } = await db
    .from("admins")
    .select("id, email, first_name, last_name")
    .eq("id", userId)
    .single();

  if (!admin) return error("Admin not found", 404);

  // Prevent demoting yourself
  if (userId === guard.user!.id) {
    return error("You cannot demote yourself", 400);
  }

  const { error: insertErr } = await db.from("customers").insert({
    id: admin.id,
    email: admin.email,
    first_name: admin.first_name,
    last_name: admin.last_name,
  });
  if (insertErr) return error(insertErr.message, 500);

  await db.from("admins").delete().eq("id", userId);
  return ok({ message: "Admin demoted to customer" });
};
