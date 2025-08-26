// src/services/auth.ts
import { supabase } from "../../lib/supabase";

// Signup
export async function signUp(
    email: string,
    password: string,
    firstName: string,
    lastName: string
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { first_name: firstName, last_name: lastName },
        },
    });
    return { data, error };
}

// Login
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

// Logout
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

// Get Current User
export async function getCurrentUser() {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();
    return { user, error };
}
