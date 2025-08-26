import type { APIRoute } from "astro";
import { signOut } from "../../../services/auth";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
    try {
        // Tell Supabase to invalidate the session server-side
        const { error } = await signOut();
        if (error) {
            console.error("Supabase signout failed:", error.message);
        }

        // Clear local cookies
        cookies.delete("sb-access-token", { path: "/" });
        cookies.delete("sb-refresh-token", { path: "/" });

        return redirect("/signin");
    } catch (err) {
        console.error(
            "Signout failed:",
            err instanceof Error ? err.message : err
        );
        // Still clear cookies even on unexpected errors
        cookies.delete("sb-access-token", { path: "/" });
        cookies.delete("sb-refresh-token", { path: "/" });

        return redirect("/signin");
    }
};
