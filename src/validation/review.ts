import { z } from "zod";

export const reviewSchema = z.object({
    userId: z.string().uuid("Invalid user ID"),
    venueId: z.string().uuid("Invalid venue ID"),
    rating: z
        .number()
        .int()
        .min(1, "Minimum rating is 1")
        .max(5, "Maximum rating is 5"),
    comment: z.string().max(500, "Comment too long").optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
