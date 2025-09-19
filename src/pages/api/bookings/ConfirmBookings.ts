import type { APIRoute } from "astro";
import { confirmBooking } from "../../../services/bookings";
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

        const { data, error } = await confirmBooking(bookingId, userId);

        if (error) {
            console.error("Confirm booking failed:", error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
            });
        }

        return new Response(
            JSON.stringify({
                message: "Booking is confirmed successfully",
                booking: data,
            }),
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error confirming booking:", err);
        return new Response(
            JSON.stringify({ error: err.message || err.toString() }),
            { status: 500 }
        );
    }
};
