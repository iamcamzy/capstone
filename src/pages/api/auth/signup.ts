import type { APIRoute } from "astro";
import { signUp } from "../../../services/auth";

export const prerender = false;

interface SignUpBody {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

export const POST: APIRoute = async ({ request, redirect }) => {
    try {
        const body = (await request.json()) as Partial<SignUpBody>;
        const { email, password, firstName, lastName } = body;

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
        console.error("Invalid request body:", err);
        return new Response("Invalid request body", { status: 400 });
    }
};
