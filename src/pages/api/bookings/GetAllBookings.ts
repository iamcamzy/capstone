import type { APIRoute } from "astro";
import { getAllBookings } from "../../../services/bookings";
export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const { data, error } = await getAllBookings();

        if (error) {
            console.error("Error fetching all bookings:", error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
            });
        }

        return new Response(
            JSON.stringify({
                message: "All bookings show kekw",
                bookings: data,
            }),
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error fetching all bookings:", err);
        return new Response(
            JSON.stringify({ error: err.message || err.toString() }),
            { status: 500 }
        );
    }
};
