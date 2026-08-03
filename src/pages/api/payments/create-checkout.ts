import type { APIRoute } from "astro";
import { z } from "zod";
import { getUser } from "../../../lib/auth";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { parseBody } from "../../../lib/parseBody";
import { error, ok } from "../../../lib/response";
import { paymongoRequest, pesoToCentavos } from "../../../lib/paymongo";

export const prerender = false;
const db = supabaseAdmin ?? supabase;
const schema = z.object({ bookingId: z.string().uuid() });

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized", 401);
  if (!user.email_confirmed_at) return error("Verify your email before paying", 403);
  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return error("Invalid bookingId", 400);

  const { data: booking } = await db.from("bookings")
    .select("id,user_id,total_price,minimum_payment_amount,status,full_name")
    .eq("id", parsed.data.bookingId).eq("user_id", user.id).single();
  if (!booking) return error("Booking not found", 404);
  if (booking.status === "cancelled") return error("Cancelled bookings cannot be paid", 409);

  const amount = Number(booking.minimum_payment_amount ?? Number(booking.total_price) * 0.5);
  if (!Number.isFinite(amount) || amount <= 0) return error("Invalid payment amount", 400);

  const { data: existing } = await db.from("payment_transactions")
    .select("id,status,checkout_url,gateway_checkout_id")
    .eq("booking_id", booking.id).eq("payment_type", "down_payment")
    .in("status", ["pending", "processing", "paid"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.status === "paid") return error("The down payment has already been paid", 409);
  if (existing?.checkout_url && ["pending", "processing"].includes(existing.status)) {
    return ok({ checkoutUrl: existing.checkout_url, paymentId: existing.id, reused: true });
  }

  const reference = `BOOKING-${booking.id.slice(0, 8).toUpperCase()}`;
  const { data: transaction, error: txError } = await db.from("payment_transactions").insert({
    booking_id: booking.id, user_id: user.id, payment_type: "down_payment", amount,
    currency: "PHP", gateway: "paymongo", status: "pending", reference_number: reference,
  }).select("id").single();
  if (txError || !transaction) return error("Could not initialize payment", 500);

  try {
    const response = await paymongoRequest("/v2/checkout_sessions", {
      method: "POST",
      body: JSON.stringify({ data: { attributes: {
        line_items: [{ name: "50% Booking Down Payment", description: reference, amount: pesoToCentavos(amount), currency: "PHP", quantity: 1 }],
        payment_method_types: ["card", "gcash", "paymaya", "grab_pay", "qrph"],
        success_url: `${url.origin}/payment/success?bookingId=${booking.id}`,
        cancel_url: `${url.origin}/payment/cancelled?bookingId=${booking.id}`,
        description: `Down payment for ${booking.full_name ?? "booking"}`,
        reference_number: reference,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        metadata: { booking_id: booking.id, transaction_id: transaction.id, user_id: user.id },
      } } }),
    });
    const checkout = response.data;
    await db.from("payment_transactions").update({
      gateway_checkout_id: checkout.id, checkout_url: checkout.attributes.checkout_url, updated_at: new Date().toISOString(),
    }).eq("id", transaction.id);
    await db.from("booking_payments").upsert({
      booking_id: booking.id, total_booking_amount: Number(booking.total_price), minimum_payment_amount: amount,
      amount_paid: 0, remaining_balance: Number(booking.total_price), payment_status: "pending",
      payment_method: "PayMongo", updated_at: new Date().toISOString(),
    }, { onConflict: "booking_id" });
    return ok({ checkoutUrl: checkout.attributes.checkout_url, paymentId: transaction.id });
  } catch (e) {
    await db.from("payment_transactions").update({ status: "failed", failure_reason: e instanceof Error ? e.message : "Checkout failed" }).eq("id", transaction.id);
    return error(e instanceof Error ? e.message : "Could not create checkout", 502);
  }
};
