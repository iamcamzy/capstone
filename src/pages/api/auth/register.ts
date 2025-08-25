import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return new Response("Email and password are required", {
                status: 400,
            });
        }

        const { error } = await supabase.auth.signUp({ email, password });

        if (error) {
            console.error("Supabase signup failed:", error.message);
            return new Response(error.message, { status: 500 });
        }

        return redirect("/signin");
    } catch (err) {
        console.error("Invalid request body:", err);
        return new Response("Invalid request body", { status: 400 });
    }
};
