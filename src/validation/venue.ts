import { z } from "zod";

export const venueSchema = z.object({
    name: z.string().min(1, "Venue name is required"),
    location: z.string().min(1, "Location is required"),
    capacity: z.number().int().positive("Capacity must be a positive number"),
    description: z.string().optional(),
});

export type VenueInput = z.infer<typeof venueSchema>;
