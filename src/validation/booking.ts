import { z } from "zod";

export const bookingSchema = z.object({
    userId: z.string().uuid("Invalid user ID"),
    venueId: z.string().uuid("Invalid venue ID"),
    startDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
    endDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), "Invalid end date"),
    guests: z.number().int().min(1, "At least 1 guest"),
});

export type BookingInput = z.infer<typeof bookingSchema>;
