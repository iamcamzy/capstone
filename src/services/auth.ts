import { supabase } from "../lib/supabase";

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName ?? null, last_name: lastName ?? null } },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}
