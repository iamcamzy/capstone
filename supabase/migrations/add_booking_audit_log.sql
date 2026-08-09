create extension if not exists "pgcrypto";

create table if not exists public.booking_audit_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid null,
  actor_type text not null
    check (actor_type in ('admin', 'staff', 'customer', 'system')),
  action text not null,
  from_status text null,
  to_status text null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_audit_log_booking_created_idx
  on public.booking_audit_log (booking_id, created_at desc);

create index if not exists booking_audit_log_action_created_idx
  on public.booking_audit_log (action, created_at desc);

alter table public.booking_audit_log enable row level security;

drop policy if exists booking_audit_log_admin_select on public.booking_audit_log;
create policy booking_audit_log_admin_select
  on public.booking_audit_log
  for select
  using (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists booking_audit_log_admin_insert on public.booking_audit_log;
create policy booking_audit_log_admin_insert
  on public.booking_audit_log
  for insert
  with check (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists booking_audit_log_customer_insert on public.booking_audit_log;
create policy booking_audit_log_customer_insert
  on public.booking_audit_log
  for insert
  with check (
    actor_type = 'customer'
    and actor_id = auth.uid()
    and exists (
      select 1
      from public.bookings
      where bookings.id = booking_audit_log.booking_id
        and bookings.user_id = auth.uid()
    )
  );
