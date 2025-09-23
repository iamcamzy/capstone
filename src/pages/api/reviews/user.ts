import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");

        if (!userId) {
            return new Response(JSON.stringify({ error: "Missing userId" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const { data, error } = await supabase
            .from("reviews")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching user reviews:", error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(
            JSON.stringify({
                message: "User reviews fetched successfully",
                reviews: data,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        console.error("API ERROR (getUserReviews):", err);
        return new Response(
            JSON.stringify({ error: err.message || "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
