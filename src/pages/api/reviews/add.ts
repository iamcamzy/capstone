import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        // Debug
        const raw = await request.text();
        console.log("RAW BODY RECEIVED:", raw);

        let body: any = null;
        try {
            body = JSON.parse(raw);
        } catch (err) {
            console.error("Failed to parse JSON:", err);
        }

        if (!body) {
            return new Response(
                JSON.stringify({ error: "Invalid or missing JSON body", raw }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const { userId, bookingId, rating, comment } = body;

        if (!userId || !bookingId || !rating) {
            return new Response(
                JSON.stringify({
                    error: "userId, bookingId, and rating are required",
                    body,
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const { data, error } = await supabase.rpc("add_review", {
            p_user_id: userId,
            p_booking_id: bookingId,
            p_rating: rating,
            p_comment: comment || null,
        });

        if (error) {
            console.error("Supabase RPC Error:", error);
            return new Response(JSON.stringify({ error, body }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ reviewId: data, body }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("API ERROR:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
