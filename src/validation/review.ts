import { z } from "zod";

/**
 * POST /api/reviews
 *
 * Required:
 *   bookingId  string (UUID) — must be a booked or completed booking owned by the user
 *   rating     number 1–5
 *
 * Optional:
 *   comment    string (max 1000 chars)
 */
export const addReviewSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
  rating:    z.number().int().min(1, "rating min is 1").max(5, "rating max is 5"),
  comment:   z.string().max(1000, "comment max 1000 chars").optional(),
});

export type AddReviewInput = z.infer<typeof addReviewSchema>;

