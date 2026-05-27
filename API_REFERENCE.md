# API Reference
> For frontend developers integrating with this backend.

## How to call an endpoint

All API routes return JSON. Always check `response.ok` first.

```js
const res  = await fetch('/api/bookings/CreateBookings', {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ venueId, startDate, endDate }),
});
const data = await res.json();

if (!res.ok) {
  console.error(data.error); // always a plain string
  return;
}
// use data.bookingId, data.totalPrice, etc.
```

**Error shape** (all errors):
```json
{ "error": "Human-readable message" }
```

**Auth** is handled by HttpOnly cookies set at sign-in — you don't manage tokens.
For 401 responses, redirect the user to `/signin`.

---

## Auth

### `POST /api/auth/signin`
Sign in. Accepts `multipart/form-data` (HTML form POST).

| Field | Type | Required |
|-------|------|----------|
| email | string | ✅ |
| password | string | ✅ |

→ On success: sets cookies, **redirects** to `/dashboard`  
→ On failure: **redirects** to `/signin?error=<message>`

---

### `POST /api/auth/signup`
Register a new account. Accepts JSON.

```json
{
  "email":     "user@example.com",
  "password":  "min6chars",
  "firstName": "Juan",
  "lastName":  "dela Cruz"
}
```

| Status | Body |
|--------|------|
| 201 | `{ "message": "Account created successfully." }` |
| 400 | `{ "error": "..." }` |

---

### `GET /api/auth/signout`
Sign out. No body needed. Clears cookies, redirects to `/signin`.

---

## Bookings

### `POST /api/bookings/CreateBookings` 🔒
Create a booking. User must be logged in.

```json
{
  "venueId":         "uuid",
  "startDate":       "2026-07-14",
  "endDate":         "2026-07-16",
  "eventDate":       "2026-07-15",
  "eventType":       "Wedding",
  "packageId":       "uuid",
  "pax":             80,
  "fullName":        "Juan dela Cruz",
  "phone":           "+63 912 345 6789",
  "specialRequests": "Please set up floral arch"
}
```

Only `venueId`, `startDate`, `endDate` are required. All others optional.

| Status | Body |
|--------|------|
| 201 | `{ "bookingId": "uuid", "totalPrice": 55000, "message": "..." }` |
| 400 | `{ "error": "validation message" }` |
| 401 | `{ "error": "Unauthorized" }` |
| 409 | `{ "error": "Venue is already booked for those dates" }` |

---

### `GET /api/bookings/GetUserBookings` 🔒
Get the logged-in user's bookings.

**Query params:**
- `status` (optional): `pending` | `confirmed` | `cancelled` | `rescheduled`

```
GET /api/bookings/GetUserBookings
GET /api/bookings/GetUserBookings?status=confirmed
```

| Status | Body |
|--------|------|
| 200 | `{ "bookings": [ { id, start_date, end_date, event_date, event_type, pax, status, total_price, special_requests, created_at, venues: { id, name, image_url, price_per_night } } ] }` |
| 401 | `{ "error": "Unauthorized" }` |

---

### `POST /api/bookings/CancelBookings` 🔒
Cancel your own booking.

```json
{ "bookingId": "uuid" }
```

| Status | Body |
|--------|------|
| 200 | `{ "message": "Booking cancelled successfully" }` |
| 403 | `{ "error": "You can only cancel your own bookings" }` |
| 404 | `{ "error": "Booking not found" }` |

---

### `GET /api/bookings/GetAllBookings` 🔒 Admin
Get all bookings with pagination.

**Query params:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `status` (optional filter)

---

### `POST /api/bookings/ConfirmBookings` 🔒 Admin
Confirm a pending booking.

```json
{ "bookingId": "uuid" }
```

---

### `POST /api/admin/reschedule` 🔒 Admin
Reschedule a booking. Creates a new booking linked to the original.

```json
{
  "bookingId":    "uuid",
  "newStartDate": "2026-08-01",
  "newEndDate":   "2026-08-03",
  "newEventDate": "2026-08-02"
}
```

| Status | Body |
|--------|------|
| 200 | `{ "message": "...", "newBookingId": "uuid" }` |

---

## Venues

### `GET /api/venues` 🌐 Public
List all active venues.

```json
{
  "venues": [
    { "id", "name", "description", "location", "capacity", "price_per_night", "image_url", "is_active" }
  ]
}
```

### `GET /api/venues/:id` 🌐 Public
Get a single venue by ID.

```json
{ "venue": { ...allVenueFields } }
```

### `POST /api/venues` 🔒 Admin
Create a venue.

```json
{
  "name": "Rooftop Garden",
  "price_per_night": 12000,
  "description": "...",
  "location": "...",
  "capacity": 100,
  "image_url": "https://..."
}
```

### `PUT /api/venues/:id` 🔒 Admin
Update a venue. All fields optional.

### `DELETE /api/venues/:id` 🔒 Admin
Deactivate a venue (soft delete — sets `is_active = false`).

---

## Packages

### `GET /api/packages` 🌐 Public
List all active packages.

```json
{
  "packages": [
    { "id", "name", "description", "price", "inclusions", "max_pax", "is_active" }
  ]
}
```

### `POST /api/packages` 🔒 Admin
Create a package.

```json
{
  "name": "Premium",
  "price": 25000,
  "description": "Full-service",
  "inclusions": "Catering, Lights, Sound",
  "max_pax": 300
}
```

### `PUT /api/packages/:id` 🔒 Admin
Update a package. All fields optional.

### `DELETE /api/packages/:id` 🔒 Admin
Deactivate a package.

---

## Reviews

### `POST /api/reviews/add` 🔒
Add a review. Only works on confirmed bookings you own.

```json
{
  "bookingId": "uuid",
  "rating":    5,
  "comment":   "Amazing experience!"
}
```

| Status | Body |
|--------|------|
| 201 | `{ "reviewId": "uuid", "message": "..." }` |
| 400 | `{ "error": "You can only review confirmed bookings" }` |
| 409 | `{ "error": "You have already reviewed this booking" }` |

---

### `GET /api/reviews/get` 🌐 Public
Get reviews for a venue.

```
GET /api/reviews/get?venueId=uuid
GET /api/reviews/get?venueId=uuid&page=2&limit=10
```

```json
{
  "reviews": [
    { "id", "rating", "comment", "created_at",
      "reviewer": { "first_name", "last_name" } }
  ],
  "averageRating": 4.5,
  "pagination": { "page", "limit", "total", "totalPages" }
}
```

---

### `GET /api/reviews/user` 🔒
Get reviews written by the logged-in user.

```json
{
  "reviews": [
    { "id", "rating", "comment", "created_at",
      "booking": { "id", "start_date", "end_date", "event_date", "venue_name" } }
  ]
}
```

---

## Admin — User Management

### `POST /api/admin/users` 🔒 Admin
Change a user's role.

```json
{ "userId": "uuid", "role": "admin" }
```

---

## Admin — Stats

### `GET /api/admin/stats` 🔒 Admin

```json
{
  "bookings":  { "total", "pending", "confirmed", "cancelled", "rescheduled", "thisMonth" },
  "revenue":   { "total": 125000 },
  "venues":    { "active": 5 },
  "users":     { "total": 48 },
  "avgPax":    85
}
```

---

## Legend
- 🌐 **Public** — no auth needed
- 🔒 **User** — must be logged in (session cookie)
- 🔒 **Admin** — must be logged in AND have `role = "admin"`
