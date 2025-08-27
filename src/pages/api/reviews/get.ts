import type { APIRoute } from "astro";
import { getVenueReviews } from "../../../services/reviews";

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const venueId = url.searchParams.get("venueId");
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "10");

        if (!venueId) {
            return new Response(
                JSON.stringify({ error: "venueId is required" }),
                { status: 400 }
            );
        }

        const reviews = await getVenueReviews(venueId, page, limit);

        if (reviews.error) {
            return new Response(
                JSON.stringify({
                    error:
                        typeof reviews.error === "object" &&
                        "message" in reviews.error
                            ? reviews.error.message
                            : reviews.error,
                }),
                { status: 500 }
            );
        }

        return new Response(
            JSON.stringify({
                data: reviews.data,
                pagination: {
                    page: reviews.page,
                    limit: reviews.limit,
                    total: reviews.count,
                    totalPages: reviews.count
                        ? Math.ceil(reviews.count / reviews.limit)
                        : 0,
                },
            }),
            { status: 200 }
        );
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
        });
    }
};
