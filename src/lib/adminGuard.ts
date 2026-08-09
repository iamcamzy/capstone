import type { AstroCookies } from "astro";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin, supabase } from "./supabase";
import { getUser } from "./auth";
import { error } from "./response";

const db = supabaseAdmin ?? supabase;

export type AppRole = "admin" | "staff" | "customer";

type RoleProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  position?: string | null;
};

export type UserRoleResult = {
  user: User;
  role: AppRole;
  profile: RoleProfile | null;
};

export async function getUserRole(cookies: AstroCookies): Promise<UserRoleResult | null> {
  const user = await getUser(cookies);
  if (!user) return null;

  const { data: admin } = await db
    .from("admins")
    .select("id, email, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (admin) return { user, role: "admin", profile: admin };

  const { data: employee } = await db
    .from("employees")
    .select("id, email, first_name, last_name, position")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (employee) return { user, role: "staff", profile: employee };

  return { user, role: "customer", profile: null };
}

export async function adminGuard(
  cookies: AstroCookies,
): Promise<(UserRoleResult & { role: "admin" }) | Response> {
  const roleInfo = await getUserRole(cookies);
  if (!roleInfo) return error("Unauthorized", 401);
  if (roleInfo.role !== "admin") return error("Forbidden: admins only", 403);
  return roleInfo as UserRoleResult & { role: "admin" };
}

export async function staffOrAdminGuard(
  cookies: AstroCookies,
): Promise<(UserRoleResult & { role: "admin" | "staff" }) | Response> {
  const roleInfo = await getUserRole(cookies);
  if (!roleInfo) return error("Unauthorized", 401);
  if (roleInfo.role !== "admin" && roleInfo.role !== "staff") {
    return error("Forbidden: staff or admins only", 403);
  }
  return roleInfo as UserRoleResult & { role: "admin" | "staff" };
}
