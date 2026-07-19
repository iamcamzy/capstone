import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../lib/adminGuard";
import { parseBody } from "../../../lib/parseBody";
import { error, ok } from "../../../lib/response";
import { supabase, supabaseAdmin } from "../../../lib/supabase";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const paymentSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
  totalBookingAmount: z.number().finite().nonnegative(),
  amountPaid: z.number().finite().nonnegative(),
  paymentStatus: z.enum(["unpaid", "partial", "paid", "refunded"]),
  paymentMethod: z.string().trim().max(100).nullable().optional(),
  paymentNotes: z.string().trim().max(2000).nullable().optional(),
  paymentRecordedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.paymentStatus === "unpaid" && value.amountPaid !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaid"], message: "Unpaid bookings must have an amount paid of zero" });
  }
  if (value.paymentStatus === "partial" && (value.amountPaid <= 0 || value.amountPaid >= value.totalBookingAmount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaid"], message: "A partial payment must be greater than zero and less than the total" });
  }
  if (value.paymentStatus === "paid" && value.amountPaid < value.totalBookingAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaid"], message: "A paid booking must have its full total recorded" });
  }
  if (value.paymentStatus !== "unpaid" && !value.paymentRecordedAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentRecordedAt"], message: "Payment recorded date is required" });
  }
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = paymentSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.errors.map((item) => item.message).join(", "), 400);

  const { data: booking, error: bookingError } = await db
    .from("bookings")
    .select("id")
    .eq("id", parsed.data.bookingId)
    .single();
  if (bookingError || !booking) return error("Booking not found", 404);

  const total = parsed.data.totalBookingAmount;
  const amountPaid = parsed.data.amountPaid;
  const payment = {
    booking_id: parsed.data.bookingId,
    total_booking_amount: total,
    minimum_payment_amount: total * 0.5,
    amount_paid: amountPaid,
    remaining_balance: parsed.data.paymentStatus === "refunded" ? total : Math.max(total - amountPaid, 0),
    payment_status: parsed.data.paymentStatus,
    payment_method: parsed.data.paymentMethod || null,
    payment_notes: parsed.data.paymentNotes || null,
    payment_recorded_at: parsed.data.paymentRecordedAt ?? null,
    recorded_by: guard.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error: dbError } = await db
    .from("booking_payments")
    .upsert(payment, { onConflict: "booking_id" })
    .select("*")
    .single();
  if (dbError) {
    console.error("[UpdateBookingPayment]", dbError.message);
    return error("Could not save payment information", 500);
  }

  return ok({ message: "Payment information saved", payment: data });
};
