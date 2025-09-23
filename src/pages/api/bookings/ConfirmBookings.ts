import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
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

        const { bookingId, userId } = body;

        if (!bookingId || !userId) {
            return new Response(
                JSON.stringify({ error: "bookingId and userId are required" }),
                { status: 400 }
            );
        }

        const { data, error } = await supabase.rpc("confirm_booking", {
            p_booking_id: bookingId,
            p_user_id: userId,
        });

        if (error) {
            console.error("Confirm booking failed:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
            });
        }

        return new Response(
            JSON.stringify({
                message: "Booking confirmed successfully",
                booking: data,
            }),
            { status: 200 }
        );
    } catch (err: any) {
        console.error("API ERROR:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Unknown error" }),
            { status: 500 }
        );
    }
};
