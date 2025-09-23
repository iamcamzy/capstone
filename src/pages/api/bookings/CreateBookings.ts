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

        const { userId, venueId, startDate, endDate, eventType } = body;

        if (!userId || !venueId || !startDate || !endDate) {
            return new Response(
                JSON.stringify({
                    error: "userId, venueId, startDate, and endDate are required",
                }),
                { status: 400 }
            );
        }

        const { data, error } = await supabase.rpc("create_booking", {
            p_user_id: userId,
            p_venue_id: venueId,
            p_start_date: startDate,
            p_end_date: endDate,
            p_event_type: eventType || null,
        });

        if (error) {
            console.error("Booking creation failed:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
            });
        }

        return new Response(
            JSON.stringify({
                message: "Booking created successfully",
                booking: data,
            }),
            { status: 201 }
        );
    } catch (err: any) {
        console.error("API ERROR:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Unknown error" }),
            { status: 500 }
        );
    }
};
