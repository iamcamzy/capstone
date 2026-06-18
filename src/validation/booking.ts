import { z } from "zod";

const dateString = z
  .string()
  .refine((v) => !isNaN(Date.parse(v)), "Invalid date — use YYYY-MM-DD");

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addOneCalendarMonth(date: Date) {
  const oneMonthLater = new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
  if (oneMonthLater.getDate() !== date.getDate()) {
    oneMonthLater.setDate(0);
  }
  return oneMonthLater;
}

function getMinimumBookingDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return addOneCalendarMonth(today);
}

export const createBookingSchema = z
  .object({
    venueId:         z.string().uuid("venueId must be a valid UUID"),
    startDate:       dateString,
    endDate:         dateString,
    eventDate:       dateString.optional(),
    eventType:       z.string().max(100).optional().nullable(),
    packageId:       z.string().uuid("packageId must be a valid UUID").optional().nullable(),
    // Accept both 'pax' and 'guests' from the form (bookingForm.astro sends 'guests')
    pax:             z.number().int().min(1, "pax must be at least 1").optional().nullable(),
    guests:          z.number().int().min(1).optional().nullable(),
    fullName:        z.string().min(1).max(200).optional().nullable(),
    email:           z.string().email("Invalid email address").max(254).optional().nullable(),
    phone:           z.string().max(30).optional().nullable(),
    // Special requests is fully optional — users can leave it blank
    specialRequests: z.string().max(1000).optional().nullable(),
    termsAccepted:   z.literal(true).optional(),
  })
  .refine(
    (d) => parseDateOnly(d.endDate) > parseDateOnly(d.startDate),
    { message: "endDate must be after startDate", path: ["endDate"] }
  )
  .refine(
    (d) => parseDateOnly(d.startDate) >= getMinimumBookingDate(),
    { message: "startDate must be at least one month in advance", path: ["startDate"] }
  )
  .transform((d) => ({
    ...d,
    // Normalize: if form sends 'guests', map it to 'pax'
    pax: d.pax ?? d.guests ?? null,
    specialRequests: d.specialRequests || null,
  }));

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
