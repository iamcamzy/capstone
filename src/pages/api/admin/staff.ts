import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../lib/adminGuard";
import { parseBody } from "../../../lib/parseBody";
import { created, error, ok } from "../../../lib/response";
import { supabaseAdmin } from "../../../lib/supabase";

export const prerender = false;

const detailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z.string().trim().max(30).optional().default(""),
  position: z.string().trim().min(1, "Position is required").max(100),
});
const createSchema = detailsSchema.extend({
  action: z.literal("create"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
const updateSchema = detailsSchema.extend({
  action: z.literal("update"),
  staffId: z.string().uuid("Invalid staff account"),
});
const statusSchema = z.object({
  action: z.enum(["activate", "deactivate"]),
  staffId: z.string().uuid("Invalid staff account"),
});
const requestSchema = z.discriminatedUnion("action", [createSchema, updateSchema, statusSchema]);

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;
  if (!supabaseAdmin) return error("Staff account management is not configured on this server", 503);

  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = requestSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.issues.map((issue) => issue.message).join(", "), 400);

  if (parsed.data.action === "create") {
    const { email, password, firstName, lastName, phone, position } = parsed.data;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (authError || !authData.user) return error(authError?.message ?? "Could not create staff account", 400);

    const { error: insertError } = await supabaseAdmin.from("employees").insert({
      id: authData.user.id, email, first_name: firstName, last_name: lastName,
      phone: phone || null, position, is_active: true, created_by: guard.user.id,
    });
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return error(insertError.message, 500);
    }
    // Auth triggers may provision every new identity as a customer. A staff
    // identity must have only the employee role, including while deactivated.
    await supabaseAdmin.from("customers").delete().eq("id", authData.user.id);
    return created({ message: "Staff account created" });
  }

  const { data: employee } = await supabaseAdmin.from("employees").select("id")
    .eq("id", parsed.data.staffId).maybeSingle();
  if (!employee) return error("Staff member not found", 404);

  if (parsed.data.action === "update") {
    const { error: updateError } = await supabaseAdmin.from("employees").update({
      first_name: parsed.data.firstName, last_name: parsed.data.lastName,
      phone: parsed.data.phone || null, position: parsed.data.position,
    }).eq("id", parsed.data.staffId);
    if (updateError) return error(updateError.message, 500);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(parsed.data.staffId, {
      user_metadata: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
    });
    if (authError) console.error("[Staff management] Auth metadata update failed:", authError.message);
    return ok({ message: "Staff details updated" });
  }

  const { error: statusError } = await supabaseAdmin.from("employees")
    .update({ is_active: parsed.data.action === "activate" }).eq("id", parsed.data.staffId);
  if (statusError) return error(statusError.message, 500);
  return ok({ message: parsed.data.action === "activate" ? "Staff account activated" : "Staff account deactivated" });
};
