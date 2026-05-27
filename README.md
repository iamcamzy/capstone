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
│   │   │   └── ConfirmBookings.ts  # POST — confirm booking (admin)
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
```

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
| POST   | `/api/bookings/ConfirmBookings` | Admin  | Confirm a pending booking                         |
| POST   | `/api/admin/reschedule`         | Admin  | Reschedule a booking                              |
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
