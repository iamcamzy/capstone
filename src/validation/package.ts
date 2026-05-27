import { z } from "zod";

/**
 * POST /api/packages  (admin — create)
 * PUT  /api/packages/:id  (admin — update)
 */
export const packageSchema = z.object({
  name:        z.string().min(1, "name is required").max(200),
  description: z.string().max(2000).optional(),
  price:       z.number().nonnegative("price must be 0 or more"),
  inclusions:  z.string().max(2000).optional(),
  max_pax:     z.number().int().positive("max_pax must be positive").optional(),
  is_active:   z.boolean().optional(),
});

export type PackageInput = z.infer<typeof packageSchema>;
