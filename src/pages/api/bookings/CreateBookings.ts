import type { APIRoute } from "astro";
import { createBooking } from "../../../services/bookings";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { userId, venueId, startDate, endDate, eventType } =
            await request.json();

        const bookingData = {
            user_id: userId,
            venue_id: venueId,
            start_date: startDate,
            end_date: endDate,
            event_type: eventType,
        };

        const { data, error } = await createBooking(bookingData);

        if (error) {
            console.error("Booking creation failed:", error.message);
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
        console.error("Error creating booking:", err);
        return new Response(
            JSON.stringify({ error: err.message || err.toString() }),
            { status: 500 }
        );
    }
};
