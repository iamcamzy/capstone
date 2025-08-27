import type { APIRoute } from "astro";
import { getUserReviews } from "../../../services/reviews";

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { data, error } = await getUserReviews(userId);

        if (error) {
            return new Response(JSON.stringify({ error }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (e) {
        console.error("GET /api/reviews failed:", e);
        return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
