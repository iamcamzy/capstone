# Vercel + PayMongo Test Deployment

This project uses Astro SSR with `@astrojs/vercel`. The PayMongo API routes and webhook are deployed as Vercel server functions.

## 1. Prepare Supabase

Run the SQL files in this order:

1. `supabase/migrations/add_woodberry_booking_package_details.sql`
2. `supabase/migrations/add_booking_notifications.sql`
3. `supabase/migrations/add_booking_payments.sql`
4. `supabase/migrations/20260803_paymongo_integration.sql`

The final migration can reject existing overlapping active bookings. Resolve or reschedule those existing records first, then rerun it.

## 2. Import into Vercel

Push this folder to GitHub, then import the repository in Vercel. Vercel should detect Astro automatically.

Build command: `npm run build`

Do not set the project as a static export. The payment endpoints require server functions.

## 3. Environment variables

In Vercel > Project > Settings > Environment Variables, add:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMONGO_SECRET_KEY` (use `sk_test_...` while testing)

Apply them to Production. Apply them to Preview too only when you intentionally test preview deployments.

Never prefix the service role key or PayMongo secret with `PUBLIC_`.

Redeploy after adding or changing variables.

## 4. Supabase authentication URLs

In Supabase > Authentication > URL Configuration:

Site URL:

`https://YOUR-PROJECT.vercel.app`

Allowed redirect URLs:

- `https://YOUR-PROJECT.vercel.app/signin`
- `https://YOUR-PROJECT.vercel.app/payment/success`
- `https://YOUR-PROJECT.vercel.app/payment/cancelled`

Local URLs may remain in the list for local development.

## 5. PayMongo webhook

In the PayMongo test-mode dashboard, create a webhook endpoint:

`https://YOUR-PROJECT.vercel.app/api/payments/webhook`

Use the stable production deployment URL. Avoid a temporary preview URL because it changes between deployments.

The production deployment must be publicly accessible. Disable Vercel Deployment Protection for this endpoint/project while testing, otherwise PayMongo cannot reach the webhook.

## 6. Test

1. Register and verify a customer account.
2. Create a booking at least seven days ahead.
3. Open the booking details and choose the 50% PayMongo payment.
4. Complete a PayMongo test checkout.
5. Open Vercel > Logs and confirm `/api/payments/webhook` received a POST request.
6. Check Supabase tables: `payment_transactions`, `booking_payments`, `bookings`, and `booking_audit_log`.

Expected successful state:

- `payment_transactions.status = paid`
- `booking_payments.payment_status = partial`
- `bookings.status = booked`

## Build verification

The packaged project was successfully built using Astro server output and the `@astrojs/vercel` adapter.
