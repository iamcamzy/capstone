## Project Structure

```
src/
├── lib/
│   ├── supabase.ts         # Supabase clients (public + service role)
│   ├── auth.ts             # Cookie-based session helpers
│   ├── adminGuard.ts       # Admin-only route protection
│   ├── parseBody.ts        # Safe JSON body parser
│   ├── response.ts         # Consistent JSON response helpers
│   └── database.types.ts   # TypeScript types (keep in sync with Supabase)
│
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signin.ts           # POST — sign in (form post)
│   │   │   ├── signup.ts           # POST — register
│   │   │   └── signout.ts          # GET  — sign out
│   │   ├── bookings/
│   │   │   ├── CreateBookings.ts   # POST — create a booking
│   │   │   ├── GetUserBookings.ts  # GET  — my bookings
│   │   │   ├── CancelBookings.ts   # POST — cancel own booking
│   │   │   ├── GetAllBookings.ts   # GET  — all bookings (admin)
│   │   │   └── ConfirmBookings.ts  # POST — mark booking as booked (admin)
│   │   ├── reviews/
│   │   │   ├── add.ts              # POST — add a review
│   │   │   ├── get.ts              # GET  — venue reviews (public)
│   │   │   └── user.ts             # GET  — my reviews
│   │   ├── venues/
│   │   │   ├── index.ts            # GET / POST — list or create venues
│   │   │   └── [id].ts             # GET / PUT / DELETE — single venue
│   │   ├── packages/
│   │   │   ├── index.ts            # GET / POST — list or create packages
│   │   │   └── [id].ts             # PUT / DELETE — update or deactivate
│   │   └── admin/
│   │       ├── stats.ts            # GET  — dashboard stats (admin)
│   │       ├── reschedule.ts       # POST — reschedule a booking (admin)
│   │       └── users.ts            # POST — change user role (admin)
│   │
│   ├── admin/
│   │   └── index.astro             # Admin dashboard (protected page)
│   ├── dashboard.astro             # User dashboard
│   ├── signin.astro
│   ├── signup.astro
│   └── events_and_booking/
│       └── events/
│           └── [venueId].astro     # Venue detail + booking form
│
├── validation/             # Zod schemas — one file per resource
│   ├── booking.ts
│   ├── review.ts
│   ├── user.ts
│   ├── venue.ts
│   └── package.ts
│
├── services/               # Reusable Supabase query helpers
│   ├── auth.ts
│   ├── bookings.ts
│   └── venues.ts
│
└── components/             # Astro + React UI components
```

---

## Getting Started

### 1. Clone the repo and install dependencies

```bash
npm install
```

### 2. Set up environment variables

Open `.env` and add your values — all three are required:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BREVO_API_KEY=
BREVO_SENDER_NAME="Woodberry Resorts and Events Place"
BREVO_SENDER_EMAIL="wbrepprototype@gmail.com"
NOTIFICATION_CRON_SECRET=
RESERVATION_CRON_SECRET=
SMS_ENABLED=false
SMS_PROVIDER=termux
TERMUX_SMS_SERVER_URL=http://YOUR_PHONE_LAN_IP:8787/send-sms
TERMUX_SMS_SERVER_TOKEN=replace-with-a-long-random-token
TERMUX_SMS_TIMEOUT_MS=10000
```

`BREVO_API_KEY` is server-only and must never be exposed to client-side code. If it is missing, booking status updates still succeed and email notifications are skipped server-side.

`TERMUX_SMS_SERVER_TOKEN` is also server-only and must never be exposed to client-side code. SMS notifications are sent only from server-side notification services. To use an Android phone as the SMS server, see `tools/termux-sms-server/README.md`, run the Termux server on the phone, set `SMS_ENABLED=true`, and point `TERMUX_SMS_SERVER_URL` to `http://PHONE_LAN_IP:8787/send-sms`.

Apply the booking notification schema changes from `supabase/migrations/add_booking_notifications.sql` before using notification preferences or reminder tracking.

### 3. Start the dev server

```bash
npm run dev
```

The site runs at `http://localhost:4321`.

## API Overview

All endpoints return JSON. Errors always return `{ "error": "message" }`.
Auth is handled by HttpOnly cookies — no token management needed on the frontend.

| Method | Route                           | Auth   | Description                                       |
| ------ | ------------------------------- | ------ | ------------------------------------------------- |
| POST   | `/api/auth/signin`              | —      | Sign in via form post → redirects to `/dashboard` |
| POST   | `/api/auth/signup`              | —      | Register new account                              |
| GET    | `/api/auth/signout`             | —      | Sign out → redirects to `/signin`                 |
| POST   | `/api/bookings/CreateBookings`  | User   | Create a booking                                  |
| GET    | `/api/bookings/GetUserBookings` | User   | Get my bookings (filter by `?status=`)            |
| POST   | `/api/bookings/CancelBookings`  | User   | Cancel own booking                                |
| GET    | `/api/bookings/GetAllBookings`  | Admin  | All bookings with pagination                      |
| POST   | `/api/bookings/ConfirmBookings` | Admin  | Mark a contract signing booking as booked         |
| POST   | `/api/admin/reschedule`         | Admin  | Reschedule a booking                              |
| POST   | `/api/admin/update-booking-status` | Admin | Update a booking to contract signing, booked, rescheduled, cancelled, or completed |
| GET/POST | `/api/user/notification-preferences` | User | View or update email/SMS notification preferences |
| POST   | `/api/notifications/send-weekly-reminders` | Admin or cron secret | Send one-week email/SMS reminders once per eligible booking channel |
| POST   | `/api/reservations/expire`     | Admin or cron secret | Remind and auto-cancel expired unpaid reservations |
| GET    | `/api/venues`                   | Public | List all active venues                            |
| GET    | `/api/venues/:id`               | Public | Get single venue                                  |
| POST   | `/api/venues`                   | Admin  | Create a venue                                    |
| PUT    | `/api/venues/:id`               | Admin  | Update a venue                                    |
| DELETE | `/api/venues/:id`               | Admin  | Deactivate a venue                                |
| GET    | `/api/packages`                 | Public | List all active packages                          |
| POST   | `/api/packages`                 | Admin  | Create a package                                  |
| PUT    | `/api/packages/:id`             | Admin  | Update a package                                  |
| DELETE | `/api/packages/:id`             | Admin  | Deactivate a package                              |
| GET    | `/api/reviews/get?venueId=`     | Public | Get reviews for a venue                           |
| GET    | `/api/reviews/user`             | User   | Get my reviews                                    |
| POST   | `/api/reviews/add`              | User   | Add a review                                      |
| GET    | `/api/admin/stats`              | Admin  | Dashboard statistics                              |
| POST   | `/api/admin/users`              | Admin  | Change a user's role                              |

For full request/response shapes, see **`API_REFERENCE.md`**.

### Weekly Reminder Cron

Call `POST /api/notifications/send-weekly-reminders` once per day from your scheduler. If `NOTIFICATION_CRON_SECRET` is set, pass it as `Authorization: Bearer YOUR_SECRET`, `x-cron-secret`, or `?secret=YOUR_SECRET`; otherwise the endpoint requires an admin session cookie.

One-week reminders are tracked per channel with `bookings.one_week_email_sent_at` and `bookings.one_week_sms_sent_at`. Email-only, SMS-only, and both-channel preferences are supported; a failed channel stays null so a later cron run can retry it without resending channels that already succeeded. The legacy `one_week_notice_sent_at` is filled only after all enabled channels are sent.

Booking submission confirmations, contract-signing schedules, status changes, reschedules, cancellations, and reminders use the customer's saved `email_notifications_enabled` and `sms_notifications_enabled` settings. When both are enabled, email and SMS are attempted independently so one provider failure does not prevent the other channel from sending. Notification failures are logged with the booking ID and channel; customer-facing API responses do not include provider error details.

#### Notification testing checklist

- [ ] Choose email only, submit a booking, and confirm that booking and later reminder notifications send by email only.
- [ ] Choose SMS only, submit a booking, and confirm that booking and later reminder notifications send by SMS only.
- [ ] Choose both and confirm that email and SMS are both attempted, including when one channel is unavailable.
- [ ] Force an email failure during a one-week reminder; confirm `one_week_email_sent_at` stays null and email retries on the next run without resending a successful SMS.
- [ ] Force an SMS failure during a one-week reminder; confirm `one_week_sms_sent_at` stays null and SMS retries on the next run without resending a successful email.
- [ ] Run the one-week reminder endpoint again and confirm channels with existing per-channel timestamps are not resent; confirm `one_week_notice_sent_at` is set only after all enabled channels are sent.
- [ ] Run the expiration job more than once in the final 24 hours and confirm `expiration_reminder_sent_at` prevents a second successful reminder.
- [ ] Run the expiration job more than once after automatic cancellation and confirm `expiration_cancel_notice_sent_at` prevents a second successful cancellation notice.

### Reservation Validity

New bookings begin as unpaid `contract_signing` reservations and are held for 48 hours. The booking API sets `reservation_created_at` to the creation time and `reservation_expires_at` to exactly 48 hours later, returns the deadline as `reservationExpiresAt`, and the customer dashboard and booking confirmation show that deadline.

Reservation lifecycle timestamps on `bookings` are:

- `reservation_created_at`: when the reservation hold began.
- `reservation_expires_at`: the 48-hour payment deadline.
- `expiration_reminder_sent_at`: set after the expiration reminder is successfully sent.
- `reservation_expired_at`: when an unpaid reservation was automatically expired.
- `expiration_cancel_notice_sent_at`: set after the automatic-cancellation notice is successfully sent.

Call `POST /api/reservations/expire` on a regular schedule (at least daily; more often gives more timely expiration). During each run it:

- sends an expiration reminder to an eligible unpaid reservation in the final 24 hours before its deadline;
- sends that reminder only once after a successful delivery, using `expiration_reminder_sent_at` as the guard;
- changes an expired, unpaid `contract_signing` booking to `cancelled`, records the expiration/cancellation timestamps and system cancellation reason, and sends a cancellation notice;
- leaves paid and partially paid bookings active; and
- releases an expired booking's dates because availability checks ignore `cancelled` bookings.

Set the server-only `RESERVATION_CRON_SECRET` to a long random value and send it as `Authorization: Bearer YOUR_SECRET`, `x-cron-secret`, or `?secret=YOUR_SECRET`. If `RESERVATION_CRON_SECRET` is absent, the endpoint falls back to `NOTIFICATION_CRON_SECRET`. If neither is configured, an authenticated admin session is required. Do not expose either token to browser code.

#### Reservation validity testing checklist

- [ ] A new unpaid booking gets `reservation_expires_at = now + 48 hours`.
- [ ] An unpaid expired reservation is automatically changed to `cancelled` with the system expiration timestamps and reason.
- [ ] A cancelled expired reservation releases its dates in `/api/bookings/availability` while active overlaps remain blocked.
- [ ] A `partial` or `paid` booking, and any booking with `amount_paid > 0`, does not expire.
- [ ] The customer dashboard shows the active deadline, expiring-soon warning, and expired-cancellation explanation correctly.
- [ ] Admin booking details and the shared staff booking view show the created time, deadline, remaining time, payment state, and cancellation reason.
- [ ] The expiration reminder sends only once.
- [ ] The expiration cancellation notice sends only once.
- [ ] `/api/reservations/expire` rejects requests without a valid cron secret or authenticated admin session.

---

## Auth Levels

| Label | Meaning                                                          |
| ----- | ---------------------------------------------------------------- |
| —     | No auth needed, public endpoint                                  |
| User  | Must be signed in (session cookie)                               |
| Admin | Must be signed in AND have `role = 'admin'` in the `users` table |

For a 401 response, redirect the user to `/signin`.
For a 403 response, the user is signed in but does not have the required role.

---

## Keeping TypeScript Types in Sync

When you change the database schema, regenerate the types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

