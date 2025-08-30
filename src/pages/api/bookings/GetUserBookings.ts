import type { APIRoute } from "astro";
import { getUserBookings } from "../../../services/bookings";
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    try {
        const userId = url.searchParams.get("userId");

        if (!userId) {
            return new Response(
                JSON.stringify({ error: "Missing userId parameter" }),
                { status: 400 }
            );
        }

        const { data, error } = await getUserBookings(userId);

        if (error) {
            console.error("Error fetching user bookings:", error.message);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
            });
        }

        return new Response(
            JSON.stringify({
                message: "User bookings fetched successfully",
                bookings: data,
            }),
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error fetching user bookings:", err);
        return new Response(
            JSON.stringify({ error: err.message || err.toString() }),
            { status: 500 }
        );
    }
};
