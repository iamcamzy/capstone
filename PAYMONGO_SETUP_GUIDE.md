# PayMongo Setup Guide

## 1. Create and verify your PayMongo account
1. Create an account in the PayMongo dashboard.
2. Complete the business/KYC verification requested by PayMongo.
3. Start in **Test Mode** until the entire flow works.

## 2. Get your API key
In the PayMongo dashboard, open **Settings → Developers** and copy the test secret key (`sk_test_...`).
Add it to your local `.env` and Vercel environment variables:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PAYMONGO_SECRET_KEY=sk_test_...
```

Never use a `PUBLIC_` prefix for the PayMongo secret key and never commit `.env`.

## 3. Run the Supabase migrations
Run all existing migrations, then run:

```text
supabase/migrations/20260803_paymongo_integration.sql
```

This adds blocked dates, staff roles, audit logs, duplicate submission protection, payment transactions, status constraints, and a database overlap exclusion constraint.

## 4. Configure the webhook
Create a webhook in **PayMongo Dashboard → Developers → Webhooks**.
Use this URL:

```text
https://YOUR-DOMAIN.com/api/payments/webhook
```

Subscribe to checkout/payment events, especially successful and failed payment events. The endpoint retrieves the PayMongo event with the secret key before trusting it.

For local webhook tests, expose your Astro server with a secure tunnel and temporarily use the tunnel URL.

## 5. Enable payment methods
Enable the methods approved for your PayMongo account. The checkout request currently asks for:

- QR Ph
- GCash
- Maya
- Cards
- GrabPay

Remove methods from `src/pages/api/payments/create-checkout.ts` when they are not enabled for your account.

## 6. Test the complete flow
1. Register a test user.
2. Confirm the Supabase verification email.
3. Create a booking at least seven days ahead.
4. Open the booking details from the customer dashboard.
5. Press **Pay 50% Down Payment**.
6. Complete the PayMongo test checkout.
7. Confirm that `payment_transactions` becomes `paid`, `booking_payments` becomes `partial`, and the booking becomes `booked`.
8. Retry the payment button and confirm that a duplicate paid payment is rejected.

## 7. Supabase email verification
In Supabase Dashboard:

1. Open **Authentication → Providers → Email**.
2. Enable email/password authentication.
3. Enable email confirmation.
4. Add your local and production URLs under **Authentication → URL Configuration**.
5. Configure custom SMTP before production because the default sender is intended for limited testing.

The sign-in page includes a **Resend verification email** action.

## 8. Production switch
After PayMongo approves your live account:

1. Replace `sk_test_...` with the live secret key in Vercel.
2. Recreate/check the production webhook URL.
3. Run a small real payment.
4. Reconcile the PayMongo reference against `payment_transactions.reference_number`.
