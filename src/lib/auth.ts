// auth.ts — server-side session helpers (cookies)
import type { AstroCookies } from "astro";
import { supabase } from "./supabase";

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export function setSessionCookies(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken: string
) {
  cookies.set("sb-access-token", accessToken, COOKIE_OPTS);
  cookies.set("sb-refresh-token", refreshToken, COOKIE_OPTS);
}

export function clearSessionCookies(cookies: AstroCookies) {
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
}

/**
 * Returns the authenticated user from cookies, or null.
 * Clears cookies automatically if the token is invalid/expired.
 */
export async function getUser(cookies: AstroCookies) {
  const access  = cookies.get("sb-access-token")?.value;
  const refresh = cookies.get("sb-refresh-token")?.value;
  if (!access || !refresh) return null;

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });

    if (error || !data.user) {
      // Token is invalid or from a different project — clear cookies to stop loops
      clearSessionCookies(cookies);
      return null;
    }

    return data.user;
  } catch {
    clearSessionCookies(cookies);
    return null;
  }
}

export const requireAuth = getUser;
