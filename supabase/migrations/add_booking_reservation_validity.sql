alter table public.bookings
  add column if not exists reservation_created_at timestamptz,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists reservation_expired_at timestamptz null,
  add column if not exists expiration_reminder_sent_at timestamptz null,
  add column if not exists expiration_cancel_notice_sent_at timestamptz null,
  add column if not exists cancellation_reason text null,
  add column if not exists cancellation_source text null;

update public.bookings
set reservation_created_at = coalesce(reservation_created_at, created_at, now())
where reservation_created_at is null;

update public.bookings
set reservation_expires_at = reservation_created_at + interval '48 hours'
where reservation_expires_at is null;

alter table public.bookings
  alter column reservation_created_at set default now(),
  alter column reservation_created_at set not null,
  alter column reservation_expires_at set default (now() + interval '48 hours'),
  alter column reservation_expires_at set not null;

create index if not exists bookings_active_reservation_expiration_idx
  on public.bookings (reservation_expires_at)
  where reservation_expired_at is null;
