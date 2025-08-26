import type { APIRoute } from "astro";
import { signIn } from "../../../services/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    try {
        const form = await request.formData();
        const email = form.get("email")?.toString().trim();
        const password = form.get("password")?.toString();

        if (!email || !password) {
            return new Response("Missing email or password", { status: 400 });
        }

        const { data, error } = await signIn(email, password);
        const session = data?.session;

        if (error || !session) {
            return new Response(error?.message ?? "Invalid credentials", {
                status: 401,
            });
        }

        cookies.set("sb-access-token", session.access_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
        });
        cookies.set("sb-refresh-token", session.refresh_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
        });

        return redirect("/dashboard");
    } catch (err) {
        console.error(
            "Signin failed:",
            err instanceof Error ? err.message : err
        );
        return new Response("Unexpected server error", { status: 500 });
    }
};
