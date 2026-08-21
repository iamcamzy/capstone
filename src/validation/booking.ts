import { z } from "zod";
import { isOnOrAfterMinimumBookingDate, parseDateOnly } from "../lib/bookingDateRules";

const dateString = z
  .string({
    required_error: "Please choose a valid booking date.",
    invalid_type_error: "Please choose a valid booking date.",
  })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid booking date.")
  .refine((v) => !Number.isNaN(parseDateOnly(v).getTime()), "Please choose a valid booking date.");

const facilityTimeRangeSchema = z.object({
  key: z.string().max(100),
  label: z.string().max(100).optional(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  roomsCount: z.string().optional().nullable(),
});

const woodberryPackageSchema = z.enum([
  "lunch-time",
  "dinner-time",
  "barkada-staycation",
  "pamilya-staycation",
  "room-rates",
], {
  errorMap: () => ({ message: "Please choose an available Woodberry package." }),
});

const packageLimits: Record<z.infer<typeof woodberryPackageSchema>, { min: number; max: number }> = {
  "lunch-time": { min: 80, max: 200 },
  "dinner-time": { min: 80, max: 200 },
  "barkada-staycation": { min: 10, max: 15 },
  "pamilya-staycation": { min: 20, max: 30 },
  "room-rates": { min: 1, max: 24 },
};

const selectedItemSchema = z.object({
  key: z.string().max(100),
  label: z.string().max(200),
  price: z.number().min(0),
  quantity: z.number().int().min(1).optional(),
  hours: z.number().min(0).optional(),
  amount: z.number().min(0).optional(),
});

const estimateSummarySchema = z.object({
  packageBase: z.number().min(0),
  rooms: z.number().min(0),
  addOns: z.number().min(0),
  extensions: z.number().min(0),
  corkage: z.number().min(0),
  total: z.number().min(0),
  minimumPayment: z.number().min(0),
  remainingBalance: z.number().min(0),
});

const termsAgreementMessage =
  "Please confirm that you have read and agree to the Terms and Conditions before submitting your request.";

const notificationPreferenceSchema = z
  .enum(["email", "sms", "both"], {
    errorMap: () => ({ message: "Please choose how you would like to receive booking updates." }),
  })
  .default("both");

export const createBookingSchema = z
  .object({
    venueId: z
      .string({
        required_error: "We could not identify the selected venue. Please return to the events page and choose the venue again.",
        invalid_type_error: "We could not identify the selected venue. Please return to the events page and choose the venue again.",
      })
      .uuid("We could not identify the selected venue. Please return to the events page and choose the venue again."),
    startDate: dateString,
    endDate: dateString,
    eventDate: dateString.optional().nullable(),
    eventType: z.string().max(100, "Please choose a valid event type.").optional().nullable(),
    packageId: z.string().uuid("The selected package reference is invalid. Please choose the package again.").optional().nullable(),
    packageType: woodberryPackageSchema,
    packagePrice: z
      .number({
        required_error: "The package estimate is missing. Please refresh the page and try again.",
        invalid_type_error: "The package estimate is invalid. Please refresh the page and try again.",
      })
      .min(0, "The package estimate is invalid. Please refresh the page and try again."),
    // Accept both pax and guests from booking forms.
    pax: z
      .number({ invalid_type_error: "Please enter the expected number of guests as a whole number." })
      .int("Please enter the expected number of guests as a whole number.")
      .min(1, "The expected number of guests must be at least 1.")
      .optional()
      .nullable(),
    guests: z
      .number({ invalid_type_error: "Please enter the expected number of guests as a whole number." })
      .int("Please enter the expected number of guests as a whole number.")
      .min(1, "The expected number of guests must be at least 1.")
      .optional()
      .nullable(),
    fullName: z
      .string({
        required_error: "Please enter the primary contact's full name.",
        invalid_type_error: "Please enter the primary contact's full name.",
      })
      .trim()
      .min(2, "Please enter the primary contact's full name.")
      .max(200, "Please shorten the primary contact's name to 200 characters or fewer."),
    email: z
      .string({
        required_error: "Please enter the email address for booking updates.",
        invalid_type_error: "Please enter the email address for booking updates.",
      })
      .trim()
      .email("Please enter a complete email address, such as name@example.com.")
      .max(254, "Please enter an email address with 254 characters or fewer."),
    phone: z
      .string({
        required_error: "Please enter a mobile number where Woodberry can contact you.",
        invalid_type_error: "Please enter a mobile number where Woodberry can contact you.",
      })
      .trim()
      .min(7, "Please enter a valid mobile number with at least 7 characters.")
      .max(30, "Please enter a mobile number with 30 characters or fewer."),
    specialRequests: z
      .string()
      .max(1000, "Please shorten your notes or special requests to 1,000 characters or fewer.")
      .optional()
      .nullable(),
    notificationPreference: notificationPreferenceSchema,
    address: z
      .string({
        required_error: "Please enter your complete home or billing address.",
        invalid_type_error: "Please enter your complete home or billing address.",
      })
      .trim()
      .min(5, "Please enter a more complete address, including your city or municipality.")
      .max(500, "Please shorten the address to 500 characters or fewer."),
    caterer: z
      .string()
      .max(200, "Please shorten the caterer's name to 200 characters or fewer.")
      .optional()
      .nullable(),
    useWoodberryCaterer: z.boolean().optional(),
    packageInclusions: z.array(facilityTimeRangeSchema).optional().nullable(),
    roomsCount: z.number().int().min(0).optional().nullable(),
    selectedRooms: z.array(selectedItemSchema).optional().nullable(),
    facilityTimeRanges: z.array(facilityTimeRangeSchema).optional().nullable(),
    additionals: z.unknown().optional().nullable(),
    addOns: z.array(selectedItemSchema).optional().nullable(),
    extensionSelections: z.array(selectedItemSchema).optional().nullable(),
    corkageSelections: z.array(selectedItemSchema).optional().nullable(),
    estimateSummary: estimateSummarySchema.optional().nullable(),
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
    { message: "Check-out date must be after check-in date.", path: ["endDate"] },
  )
  .refine(
    (d) => isOnOrAfterMinimumBookingDate(d.startDate),
    { message: "Check-in must be at least one week in advance.", path: ["startDate"] },
  )
  .refine(
    (d) => !d.eventDate || isOnOrAfterMinimumBookingDate(d.eventDate),
    { message: "Event date must be at least one week in advance.", path: ["eventDate"] },
  )
  .refine(
    (d) =>
      !d.eventDate ||
      (parseDateOnly(d.eventDate) >= parseDateOnly(d.startDate) &&
        parseDateOnly(d.eventDate) <= parseDateOnly(d.endDate)),
    { message: "Event date must fall within the selected booking dates.", path: ["eventDate"] },
  )
  .refine(
    (d) => {
      const pax = d.pax ?? d.guests ?? null;
      if (!pax) return false;
      const limits = packageLimits[d.packageType];
      return pax >= limits.min && pax <= limits.max;
    },
    {
      message: "The expected number of guests must fit within the selected package's guest limit.",
      path: ["pax"],
    },
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
