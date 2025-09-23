import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const venueId = url.searchParams.get("venueId");
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "10");
        const offset = (page - 1) * limit;

        if (!venueId) {
            return new Response(JSON.stringify({ error: "Missing venueId" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const { data, error, count } = await supabase
            .from("reviews")
            .select(
                `
            *, booking:bookings(*, venue:venues(*))
        `,
                { count: "exact" }
            )
            .eq("booking.venue_id", venueId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("Error fetching venue reviews:", error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(
            JSON.stringify({
                message: "Venue reviews fetched successfully",
                data,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: count ? Math.ceil(count / limit) : 0,
                },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        console.error("API ERROR (getVenueReviews):", err);
        return new Response(
            JSON.stringify({ error: err.message || "Unknown error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
