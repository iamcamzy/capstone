// POST /api/admin/update-booking-status - update a booking status (admin only)
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { normalizeBookingStatus, type BookingStatus } from "../../../lib/bookingStatus";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import {
  updateBookingStatusAndNotify,
  updateContractSigningScheduleAndNotify,
} from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const ALLOWED_STATUS_UPDATES: BookingStatus[] = [
  "contract_signing",
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
];

const updateStatusSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
  status: z.string().min(1, "status is required").optional(),
  contractSigningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "contractSigningDate must use YYYY-MM-DD")
    .optional(),
  contractSigningTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "contractSigningTime must use HH:mm")
    .optional(),
}).superRefine((value, ctx) => {
  const hasScheduleDate = value.contractSigningDate !== undefined;
  const hasScheduleTime = value.contractSigningTime !== undefined;
  if (!value.status && !hasScheduleDate && !hasScheduleTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "status or contract signing schedule is required",
      path: ["status"],
    });
  }
  if (hasScheduleDate !== hasScheduleTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "contractSigningDate and contractSigningTime must be provided together",
      path: ["contractSigningDate"],
    });
  }
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = updateStatusSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  if (parsed.data.status && !ALLOWED_STATUS_UPDATES.includes(parsed.data.status as BookingStatus)) {
    return error(`status must be one of: ${ALLOWED_STATUS_UPDATES.join(", ")}`, 400);
  }
  const status = parsed.data.status ? normalizeBookingStatus(parsed.data.status) : null;

  try {
    const hasSchedule =
      parsed.data.contractSigningDate !== undefined &&
      parsed.data.contractSigningTime !== undefined;
    const result = hasSchedule
      ? await updateContractSigningScheduleAndNotify(
          parsed.data.bookingId,
          {
            contractSigningDate: parsed.data.contractSigningDate!,
            contractSigningTime: parsed.data.contractSigningTime!,
          },
          { client: db },
        )
      : await updateBookingStatusAndNotify(parsed.data.bookingId, status!, { client: db });

    return ok({
      message: hasSchedule
        ? "Contract signing schedule updated successfully"
        : "Booking status updated successfully",
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[UpdateBookingStatus]", message);
    return error(message, 500);
  }
};
