import type { APIRoute } from "astro";
import { cancelBooking } from "../../../services/bookings";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { bookingId, userId } = await request.json();

        if (!bookingId || !userId) {
            return new Response(
                JSON.stringify({ error: "bookingId and userId are required" }),
                { status: 400 }
            );
        }

        const { data, error } = await cancelBooking(bookingId, userId);

        if (error) {
            console.error("Cancel booking failed:", error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
            });
        }

        return new Response(
            JSON.stringify({
                message: "❌ Booking cancelled successfully",
                booking: data,
            }),
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error cancelling booking:", err);
        return new Response(
            JSON.stringify({ error: err.message || err.toString() }),
            { status: 500 }
        );
    }
};
