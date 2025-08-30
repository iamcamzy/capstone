import type { APIRoute } from "astro";
import { addReview } from "../../../services/reviews";

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { userId, bookingId, rating, comment } = body;

        if (!userId || !bookingId || !rating) {
            return new Response(
                JSON.stringify({
                    error: "userId, bookingId, and rating are required",
                }),
                { status: 400 }
            );
        }

        const review = await addReview(
            userId,
            bookingId,
            rating,
            comment || ""
        );

        if (review.error) {
            return new Response(
                JSON.stringify({
                    error:
                        typeof review.error === "object" &&
                        "message" in review.error
                            ? review.error.message
                            : review.error,
                }),
                { status: 500 }
            );
        }

        return new Response(JSON.stringify(review.data), { status: 201 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
        });
    }
};
