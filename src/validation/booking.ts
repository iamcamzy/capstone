import { z } from "zod";

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date - use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(parseDateOnly(v).getTime()), "Invalid date - use YYYY-MM-DD");

const facilityTimeRangeSchema = z.object({
  key: z.string().max(100),
  label: z.string().max(100).optional(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  roomsCount: z.string().optional().nullable(),
});

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

const termsAgreementMessage =
  "You must agree to the Terms and Conditions before submitting your booking.";

const notificationPreferenceSchema = z.enum(["email", "sms", "both"]).default("both");

export const createBookingSchema = z
  .object({
    venueId: z.string().uuid("venueId must be a valid UUID"),
    startDate: dateString,
    endDate: dateString,
    eventDate: dateString.optional().nullable(),
    eventType: z.string().max(100).optional().nullable(),
    packageId: z.string().uuid("packageId must be a valid UUID").optional().nullable(),
    // Accept both pax and guests from booking forms.
    pax: z.number().int().min(1, "pax must be at least 1").optional().nullable(),
    guests: z.number().int().min(1).optional().nullable(),
    fullName: z.string().min(1).max(200).optional().nullable(),
    email: z.string().email("Invalid email address").max(254).optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    specialRequests: z.string().max(1000).optional().nullable(),
    notificationPreference: notificationPreferenceSchema,
    address: z.string().max(500).optional().nullable(),
    caterer: z.string().max(200).optional().nullable(),
    useWoodberryCaterer: z.boolean().optional(),
    packageInclusions: z.array(facilityTimeRangeSchema).optional().nullable(),
    roomsCount: z.number().int().min(0).optional().nullable(),
    facilityTimeRanges: z.array(facilityTimeRangeSchema).optional().nullable(),
    additionals: z.unknown().optional().nullable(),
    minimumPaymentAmount: z.number().min(0).optional().nullable(),
    remainingBalanceAmount: z.number().min(0).optional().nullable(),
    termsAccepted: z
      .boolean({
        required_error: termsAgreementMessage,
        invalid_type_error: termsAgreementMessage,
      })
      .refine((accepted) => accepted, {
        message: termsAgreementMessage,
      }),
  })
  .refine(
    (d) => parseDateOnly(d.endDate) > parseDateOnly(d.startDate),
    { message: "endDate must be after startDate", path: ["endDate"] },
  )
  .refine(
    (d) => parseDateOnly(d.startDate) >= getMinimumBookingDate(),
    { message: "startDate must be at least one month in advance", path: ["startDate"] },
  )
  .refine(
    (d) => !d.eventDate || parseDateOnly(d.eventDate) >= getMinimumBookingDate(),
    { message: "eventDate must be at least one month in advance", path: ["eventDate"] },
  )
  .refine(
    (d) =>
      !d.eventDate ||
      (parseDateOnly(d.eventDate) >= parseDateOnly(d.startDate) &&
        parseDateOnly(d.eventDate) <= parseDateOnly(d.endDate)),
    { message: "eventDate must fall within the selected booking dates", path: ["eventDate"] },
  )
  .transform((d) => ({
    ...d,
    pax: d.pax ?? d.guests ?? null,
    specialRequests: d.specialRequests || null,
    emailNotificationsEnabled:
      d.notificationPreference === "email" || d.notificationPreference === "both",
    smsNotificationsEnabled:
      d.notificationPreference === "sms" || d.notificationPreference === "both",
  }));

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
