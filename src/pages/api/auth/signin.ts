import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    try {
        const form = await request.formData();
        const email = form.get("email")?.toString().trim();
        const password = form.get("password")?.toString();

        if (!email || !password) {
            return new Response("Missing email or password", { status: 400 });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.session) {
            return new Response(error?.message ?? "Invalid credentials", {
                status: 401,
            });
        }

        const { access_token, refresh_token } = data.session;

        // Persist session via cookies
        cookies.set("sb-access-token", access_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
        });
        cookies.set("sb-refresh-token", refresh_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
        });

        return redirect("/dashboard");
    } catch (err) {
        console.error("Signin failed:", err);
        return new Response("Unexpected server error", { status: 500 });
    }
};
