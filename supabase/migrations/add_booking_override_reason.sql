alter table public.bookings
  add column if not exists override_reason text null;
