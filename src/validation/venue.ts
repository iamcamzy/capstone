import { z } from "zod";

/**
 * POST /api/venues  (admin — create)
 * PUT  /api/venues/:id  (admin — update, all fields optional)
 */
export const venueSchema = z.object({
  name:            z.string().min(1, "name is required").max(200),
  description:     z.string().max(2000).optional(),
  location:        z.string().max(300).optional(),
  capacity:        z.number().int().positive("capacity must be positive").optional(),
  price_per_night: z.number().positive("price_per_night must be positive"),
  image_url:       z.string().url("image_url must be a valid URL").optional().or(z.literal("")),
});

export type VenueInput = z.infer<typeof venueSchema>;
