import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { paymongoRequest } from "../../../lib/paymongo";
import { logBookingAudit } from "../../../services/bookingAudit";
export const prerender = false;
const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request }) => {
  const event = await request.json().catch(() => null);
  const eventId = event?.data?.id;
  if (!eventId) return new Response("Invalid event", { status: 400 });
  try {
    const verified = await paymongoRequest(`/v1/events/${eventId}`);
    const type = verified?.data?.attributes?.type ?? event?.data?.attributes?.type;
    const resource = verified?.data?.attributes?.data ?? event?.data?.attributes?.data;
    const attrs = resource?.attributes ?? {};
    const metadata = attrs.metadata ?? resource?.attributes?.payment_intent?.attributes?.metadata ?? {};
    const transactionId = metadata.transaction_id;
    if (!transactionId) return new Response("ok", { status: 200 });

    const paid = type === "checkout_session.payment.paid" || type === "payment.paid";
    const failed = type === "payment.failed";
    const status = paid ? "paid" : failed ? "failed" : "pending";
    const payment = attrs.payments?.[0]?.attributes ?? attrs;
    const method = payment?.source?.type ?? payment?.payment_method_type ?? null;
    const gatewayPaymentId = attrs.payments?.[0]?.id ?? resource?.id ?? null;
    const { data: tx } = await db.from("payment_transactions").update({
      status, payment_method: method, gateway_payment_id: gatewayPaymentId,
      paid_at: paid ? new Date().toISOString() : null,
      failure_reason: failed ? payment?.last_payment_error?.failed_message ?? "Payment failed" : null,
      updated_at: new Date().toISOString(),
    }).eq("id", transactionId).select("booking_id,amount,status").single();

    if (paid && tx) {
      const { data: booking } = await db.from("bookings").select("id,total_price,status").eq("id", tx.booking_id).single();
      if (booking) {
        const total = Number(booking.total_price);
        const amount = Number(tx.amount);
        const nextStatus =
          booking.status === "contract_signing" || booking.status === "rescheduled"
            ? "booked"
            : booking.status;
        await db.from("booking_payments").upsert({
          booking_id: booking.id, total_booking_amount: total, minimum_payment_amount: amount,
          amount_paid: amount, remaining_balance: Math.max(total - amount, 0), payment_status: amount >= total ? "paid" : "partial",
          payment_method: method ?? "PayMongo", payment_recorded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: "booking_id" });
        if (booking.status === "contract_signing" || booking.status === "rescheduled") {
          await db.from("bookings").update({ status: "booked", confirmed_at: new Date().toISOString(), status_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", booking.id);
        }
        await logBookingAudit(
          {
            bookingId: booking.id,
            actorType: "system",
            action: "payment_succeeded",
            fromStatus: booking.status,
            toStatus: nextStatus,
            reason: "Verified PayMongo webhook",
            metadata: {
              transactionId,
              gatewayPaymentId,
              amountPaid: amount,
              totalBookingAmount: total,
              paymentMethod: method ?? "PayMongo",
              paymentStatus: amount >= total ? "paid" : "partial",
            },
          },
          db,
        );
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[PayMongoWebhook]", e);
    return new Response("Webhook verification failed", { status: 400 });
  }
};
