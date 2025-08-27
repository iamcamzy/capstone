import type { APIRoute } from "astro";
import { getVenueReviews } from "../../../services/reviews";

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const venueId = url.searchParams.get("venueId");

        if (!venueId) {
            return new Response(
                JSON.stringify({ error: "venueId is required" }),
                { status: 400 }
            );
        }

        const reviews = await getVenueReviews(venueId);

        if (reviews.error) {
            return new Response(
                JSON.stringify({
                    error: reviews.error.message ?? reviews.error,
                }),
                { status: 500 }
            );
        }

        return new Response(JSON.stringify(reviews.data), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
        });
    }
};
