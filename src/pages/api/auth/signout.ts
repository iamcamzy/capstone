import type { APIRoute } from "astro";
import { signOut } from "../../../services/auth";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
    let errorMessage: string | undefined;

    try {
        // Ask Supabase to invalidate the session server-side
        const { error } = await signOut();
        if (error) {
            console.error("Supabase signout error:", error.message);
            errorMessage = error.message;
        }
    } catch (err) {
        console.error("Unexpected signout failure:", err);
        errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Always clear cookies
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });

    // Logs a warning if there was error in signout
    if (errorMessage) {
        console.warn("User redirected to /signin despite signout issues.");
    }

    return redirect("/signin");
};
