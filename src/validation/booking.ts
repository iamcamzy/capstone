import { z } from "zod";

const dateString = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), "Invalid date — use YYYY-MM-DD");

/**
 * POST /api/bookings
 *
 * Required fields:
 *   venueId   string (UUID)
 *   startDate string (YYYY-MM-DD) — check-in / venue hold start
 *   endDate   string (YYYY-MM-DD) — check-out / venue hold end
 *
 * Optional fields:
 *   eventDate       string (YYYY-MM-DD) — the actual day of the event
 *   eventType       string              — free-text event label
 *   packageId       string (UUID)       — selected package
 *   pax             number              — number of attendees
 *   fullName        string
 *   phone           string
 *   specialRequests string (max 1000 chars)
 */
export const createBookingSchema = z
  .object({
    venueId:         z.string().uuid("venueId must be a valid UUID"),
    startDate:       dateString,
    endDate:         dateString,
    eventDate:       dateString.optional(),
    eventType:       z.string().max(100).optional(),
    packageId:       z.string().uuid("packageId must be a valid UUID").optional(),
    pax:             z.number().int().min(1, "pax must be at least 1").optional(),
    fullName:        z.string().min(1).max(200).optional(),
    phone:           z.string().max(30).optional(),
    specialRequests: z.string().max(1000).optional(),
  })
  .refine(
    (d) => new Date(d.endDate) > new Date(d.startDate),
    { message: "endDate must be after startDate", path: ["endDate"] }
  )
  .refine(
    (d) => new Date(d.startDate) >= new Date(new Date().toDateString()),
    { message: "startDate cannot be in the past", path: ["startDate"] }
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
