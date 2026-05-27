import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file."
  );
}

// Public client — uses anon key, respects RLS
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client — uses service role key, bypasses RLS (server-side only!)
export const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Build an authenticated Supabase client from cookie tokens.
 * Use this in Astro API routes that need the current user's session.
 */
export function createServerClient(accessToken: string, refreshToken: string) {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return client;
}
