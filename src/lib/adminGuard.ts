import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin, supabase } from "./supabase";
import { getUser } from "./auth";
import { error } from "./response";

const db = supabaseAdmin ?? supabase;

export type AppRole = "admin" | "staff" | "customer" | "none";

const AUTH_REQUIRED = "Unauthorized: please sign in";
const ADMIN_REQUIRED = "Forbidden: admin access required";
const STAFF_REQUIRED = "Forbidden: staff or admin access required";
const CUSTOMER_REQUIRED = "Forbidden: customer access required";

type RoleProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
  position?: string | null;
};

export type UserRoleResult =
  | { user: User; role: Exclude<AppRole, "none">; profile: RoleProfile | null }
  | { user: User | null; role: "none"; profile: null };

export function getDashboardPathForRole(role: AppRole): "/admin" | "/staff" | "/dashboard" {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/dashboard";
}

export async function getUserRole(cookies: AstroCookies): Promise<UserRoleResult> {
  const user = await getUser(cookies);
  if (!user) return { user: null, role: "none", profile: null };

  const { data: admin } = await db
    .from("admins")
    .select("id, email, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (admin) return { user, role: "admin", profile: admin };

  const { data: employee } = await db
    .from("employees")
    .select("id, email, first_name, last_name, phone, position")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (employee) return { user, role: "staff", profile: employee };

  const { data: customer } = await db
    .from("customers")
    .select("id, email, first_name, last_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (customer) return { user, role: "customer", profile: customer };

  return { user, role: "none", profile: null };
}

export async function adminGuard(
  cookies: AstroCookies,
): Promise<(UserRoleResult & { role: "admin" }) | Response> {
  const roleInfo = await getUserRole(cookies);
  if (!roleInfo.user) return error(AUTH_REQUIRED, 401);
  if (roleInfo.role !== "admin") return error(ADMIN_REQUIRED, 403);
  return roleInfo as UserRoleResult & { role: "admin" };
}

export async function staffOrAdminGuard(
  cookies: AstroCookies,
): Promise<(UserRoleResult & { role: "admin" | "staff" }) | Response> {
  const roleInfo = await getUserRole(cookies);
  if (!roleInfo.user) return error(AUTH_REQUIRED, 401);
  if (roleInfo.role !== "admin" && roleInfo.role !== "staff") {
    return error(STAFF_REQUIRED, 403);
  }
  return roleInfo as UserRoleResult & { role: "admin" | "staff" };
}

export async function customerGuard(
  cookies: AstroCookies,
): Promise<(UserRoleResult & { role: "customer" }) | Response> {
  const roleInfo = await getUserRole(cookies);
  if (!roleInfo.user) return error(AUTH_REQUIRED, 401);
  if (roleInfo.role !== "customer") return error(CUSTOMER_REQUIRED, 403);
  return roleInfo as UserRoleResult & { role: "customer" };
}
