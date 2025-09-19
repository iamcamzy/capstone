import { supabase } from "../lib/supabase";

export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

export async function signUp(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                first_name: firstName ?? null,
                last_name: lastName ?? null,
            },
        },
    });

    return { data, error };
}

export async function signOut() {
    return supabase.auth.signOut();
}
