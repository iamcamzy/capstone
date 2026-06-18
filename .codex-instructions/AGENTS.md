# Project Context

Repository: `iamcamzy/capstone`

This project is a web-based resort and events management system for Woodberry Resort and Events. It uses Astro, TypeScript, Supabase/PostgreSQL, and utility-style CSS classes.

This file is the standing project context for all future Codex tasks involving changes, additions, removals, fixes, refactors, UI updates, backend changes, database preparation, and feature implementation inside this project folder.

---

## Core Rule

Before making any change, inspect the current relevant files first.

Do not assume the project state from memory. The project changes frequently, so always read the actual current files before editing.

---

## General Development Rules

* Make targeted changes based on the specific task.
* Do not make unrelated changes.
* Do not remove existing working functionality unless the task explicitly asks for it.
* Preserve existing routes, APIs, auth behavior, and database behavior unless the task explicitly asks to change them.
* Do not expose secrets, API keys, Supabase service role keys, Brevo keys, or environment variables.
* Do not hardcode private credentials.
* Prefer clear, simple, maintainable code over clever code.
* Keep TypeScript/Astro code readable.
* Add comments only when they clarify future work or prevent confusion.
* Do not over-engineer features unless the task asks for a full system-level implementation.

---

## Required Build Check

After every task, run:

```bash
npm run build
```

Fix all Astro, TypeScript, import, route, schema, and build errors before finishing.

If the build fails because of an existing unrelated issue, explain that clearly and identify the failing file.

---

## Visual Design Direction

All designs must be based on the current landing page.

The Woodberry theme should be strongly applied across the whole system.

Use the landing page as the main visual reference:

* soft resort/nature tone
* warm neutral background
* green primary accents
* clean spacing
* rounded cards
* soft shadows
* calm, polished resort feel
* nature-inspired visual hierarchy
* readable typography
* elegant but simple UI

Preferred design colors and style cues:

* light background: `#f2f5ee`
* primary green: `#4a7c3f`
* deep green: `#1a2e10`
* dark green: `#2d5a27`
* soft off-white: `#f7f9f4`
* pale green border/accent: `#dde8d4`
* light green hover/background: `#e8f2e3`
* existing warm accent: `#ed9b40`
* existing neutral dark: `#363537`
* existing muted warm tone: `#aa8f66`

Typography/design feel:

* Use serif headings where it matches the landing page style, especially major page titles.
* Use clean sans-serif body text.
* Use rounded cards, panels, modals, buttons, and inputs.
* Use subtle shadows, not harsh shadows.
* Use green/warm accents instead of generic blue/purple dashboard colors.

Avoid:

* generic admin dashboard styling
* unrelated bright colors
* harsh black/white contrast unless already used intentionally
* mismatched button styles
* redesigning a whole page when only a focused component update is needed
* changing the landing page design direction without explicit instruction

If adding or changing UI anywhere, make it feel like it belongs to the Woodberry landing page.

---

## Responsiveness Requirements

All redesigned pages, components, forms, modals, dashboards, and layouts must be responsive across desktop, tablet, and mobile.

Do not assume a fixed desktop width.

Use:

* flexible layouts
* wrapping grids
* responsive spacing
* readable font sizes
* mobile-safe modals
* touch-friendly buttons and controls

### Mobile Requirements

For mobile layouts, approximately `360px–430px` wide:

* Avoid horizontal page scrolling.
* Stack cards, panels, form sections, and dashboard sections vertically.
* Keep buttons large enough to tap comfortably.
* Keep form inputs full-width when appropriate.
* Keep labels readable and close to their inputs.
* Keep modals within the viewport.
* Make modal content scrollable if it is long.
* Avoid cramped two-column layouts.
* Tables should either:

  * scroll horizontally inside a contained wrapper, or
  * convert into readable stacked/card-style layouts when practical.
* Sidebar navigation should collapse, stack, or become easier to access on small screens.
* Important actions should remain visible and usable without awkward zooming.

### Tablet Requirements

For tablet layouts, approximately `768px` wide:

* Use balanced one-column or two-column layouts depending on content.
* Avoid overly wide forms.
* Keep cards and dashboard panels readable.
* Ensure buttons, filters, tabs, and tables have enough spacing.
* Avoid layout overflow.

### Desktop Requirements

For desktop layouts, `1024px` and wider:

* Preserve spacious Woodberry-style layouts.
* Use multi-column layouts where they improve readability.
* Keep page sections visually balanced.
* Avoid stretching forms, cards, and text blocks too wide.
* Maintain the polished resort-style spacing and hierarchy.

### Modal Responsiveness

All modals must:

* Dim the background when open.
* Stay centered on desktop.
* Fit within the viewport on mobile.
* Use scrollable content for long text.
* Keep action buttons visible and usable.
* Avoid overflowing off-screen.
* Allow easy closing when appropriate.

### Form Responsiveness

All forms must:

* Use full-width inputs on mobile.
* Use clean two-column layouts only when screen width allows.
* Keep validation messages readable.
* Avoid cramped checkbox/radio groups.
* Keep submit and action buttons easy to tap.
* Preserve the Woodberry visual style on all screen sizes.

### Dashboard and Table Responsiveness

Dashboards must:

* Stack stat cards on mobile.
* Keep tables readable.
* Use horizontal scroll wrappers for large tables when needed.
* Keep filters/search controls accessible.
* Avoid hiding important admin or customer actions.
* Keep status badges and action buttons legible.

### Required Responsive Check

When making UI changes, test or reason through these common breakpoints:

* Mobile: `360px–430px`
* Tablet: `768px`
* Desktop: `1024px+`

Do not finish a redesign task if the layout clearly breaks on mobile, tablet, or desktop.

---

## Light/Dark Mode Rule

If a page or component already supports light/dark mode, preserve that support.

When changing UI:

* Update both light and dark states if needed.
* Do not break existing theme toggles.
* Do not create a new theme system unless explicitly requested.
* If dark mode is missing, do not invent a full dark mode unless the task asks for it.

---

## Important Project Files

Common files to inspect depending on the task:

### Layout and Global UI

* `src/layouts/Layout.astro`
* `src/components/Header.astro`
* `src/styles/global.css`
* `src/pages/index.astro`

### Events and Booking

* `src/components/eventCards/eventCard.astro`
* `src/pages/events_and_booking/events/[venueId].astro`
* `src/components/bookingForm.astro`
* `src/pages/api/bookings/CreateBookings.ts`
* `src/pages/api/bookings/GetUserBookings.ts`
* `src/pages/api/bookings/CancelBookings.ts`
* `src/pages/api/bookings/GetAllBookings.ts`
* `src/pages/api/bookings/ConfirmBookings.ts`
* `src/validation/booking.ts`
* `src/services/bookings.ts`
* `src/services/venues.ts`

### Authentication

* `src/lib/auth.ts`
* `src/pages/signin.astro`
* `src/pages/signup.astro`
* `src/pages/api/auth/signin.ts`
* `src/pages/api/auth/signup.ts`
* `src/pages/api/auth/signout.ts`

### Admin

* `src/pages/admin/index.astro`
* `src/pages/api/admin/update-booking-status.ts`
* `src/pages/api/admin/reschedule.ts`
* admin-related utilities and API files

### Notifications

* `src/services/notifications.ts`
* `src/services/email.ts`
* `src/services/sms.ts`
* `src/pages/api/notifications/send-weekly-reminders.ts`
* `src/pages/api/user/notification-preferences.ts`

### Supabase

* `src/lib/supabase.ts`
* `src/lib/database.types.ts`
* `supabase/migrations/`

---

## Booking System Rules

The booking system should allow public browsing but protect actual booking actions.

Public users may:

* view the landing page
* view gallery pages
* view venues/events
* view basic venue information
* check general availability if implemented publicly

Logged-in users may:

* access booking forms
* submit booking requests
* view their dashboard
* manage their own bookings where supported

The booking API must stay protected server-side. Do not rely only on frontend checks.

---

## Booking Status Rules

Use the current booking status lifecycle unless the task explicitly changes it.

Final intended statuses:

* `contract_signing`
* `booked`
* `rescheduled`
* `cancelled`
* `completed`

Avoid reintroducing:

* `pending`
* `confirmed`

Legacy data may still need normalization:

* `pending` should map to `contract_signing`
* `confirmed` should map to `booked`

Do not change status behavior unless the task explicitly concerns booking workflow or admin status management.

---

## Booking Form Design Rules

The booking form should match the Woodberry theme and current booking form style.

When adding fields:

* match current input styles
* use rounded borders
* use clear labels
* keep spacing consistent
* keep the form mobile-friendly
* include fields in the review/confirmation modal if relevant
* do not make the form visually cluttered

Current and expected booking form areas may include:

* guest information
* address
* email
* phone
* date selection
* event date
* event type
* number of guests / pax
* caterer
* Woodberry caterer option
* package inclusions/facilities
* rooms count
* facility date/time ranges
* special requests
* additionals placeholder
* estimated total
* 50% minimum payment for face-to-face contract signing
* remaining estimated balance
* Terms and Conditions flow

Do not add admin-only payment fields to the customer booking form.

Admin-only / physical contract fields include:

* payment received by
* OR number
* OR date
* final adjusted total
* signature/conforme
* physical contract signing records
* finalized additionals management

---

## Terms and Conditions Rule

If Terms and Conditions are part of a booking task:

* show them before final submission
* use a modal or scrollable panel
* dim the background for modal flows
* include a required checkbox
* prevent submission unless the checkbox is checked
* keep the flow styled like Woodberry

Do not hide the full Terms and Conditions behind only a small link unless the task asks for that.

---

## Date Validation Rule

If booking date validation is involved:

* enforce frontend validation
* enforce backend validation
* avoid timezone bugs by comparing date-only values where possible
* do not allow users to bypass date rules through direct API calls

Current preferred rule:

* bookings must be at least one calendar month in advance

Example:

* If today is June 18, the earliest bookable date should be July 18.

---

## Database and Migration Rules

Do not add or modify database schema unless the task explicitly asks for it.

When a task is still client-side or design-only:

* prepare database-related code only as comments or TODOs if useful
* do not create migrations prematurely
* do not modify `database.types.ts` unless schema has actually changed

When adding a migration:

* make it idempotent where possible
* use `add column if not exists` where appropriate
* avoid destructive changes unless explicitly requested
* preserve existing data when renaming/migrating status or fields
* update related validation/types only when necessary

Do not delete migration files casually. Migrations are part of database setup/history.

---

## Admin UI Rules

Admin UI should also follow the Woodberry landing page design direction.

When changing admin:

* preserve existing admin functionality
* preserve tab/page structure unless the task asks for a redesign
* keep tables readable
* make action buttons clear
* keep status badges consistent
* avoid generic blue/purple dashboard styling
* use Woodberry greens, warm neutrals, rounded cards, and soft shadows

Do not change admin-side features during customer booking form tasks unless explicitly requested.

---

## Notification Rules

Do not break notification behavior.

Customer notification preferences:

* email notifications
* SMS notifications
* user should not be able to disable both if the database/app enforces that rule

Booking notification behavior may include:

* status change notifications
* one-week reminders
* email/SMS readiness

Do not expose Brevo or SMS credentials.

---

## Authentication Rules

Use the existing auth helper:

* `getUser(Astro.cookies)`

When protecting pages:

* check auth server-side where possible
* do not rely only on client-side hiding
* preserve public browsing when appropriate
* protect actual booking submission and booking form access

Signin path:

* `/signin`

Signup path:

* `/signup`

Dashboard path:

* `/dashboard`

Admin path:

* `/admin`

---

## Error Handling Rules

Use existing response helpers where available:

* `created`
* `error`
* other helpers in `src/lib/response.ts`

For UI errors:

* use existing notice/banner systems if present
* keep messages clear and user-friendly
* avoid raw technical errors in customer-facing UI unless helpful

---

## Scope Discipline

Each task should clearly separate:

* frontend/UI changes
* backend/API changes
* database/migration changes
* admin changes
* customer-facing changes

Do not combine these unless the prompt asks for it.

When uncertain, make the smallest safe change and leave a TODO comment.

---

## Final Response Expected From Codex

After making changes, summarize:

* files changed
* what was added/changed/removed
* whether `npm run build` passed
* any TODOs left intentionally
* any database changes made or intentionally avoided
