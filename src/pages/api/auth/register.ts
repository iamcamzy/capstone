import type { APIRoute } from "astro";
import { signUp } from "../../../services/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
    try {
        const { email, password, firstName, lastName } = await request.json();

        if (!email || !password) {
            return new Response("Email and password are required", {
                status: 400,
            });
        }

        const { error } = await signUp(email, password, firstName, lastName);

        if (error) {
            console.error("Supabase signup failed:", error.message);
            return new Response(error.message, { status: 500 });
        }

        return redirect("/signin");
    } catch (err) {
        console.error(
            "Invalid request body:",
            err instanceof Error ? err.message : err
        );
        return new Response("Invalid request body", { status: 400 });
    }
};
