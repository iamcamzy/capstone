create extension if not exists "pgcrypto";

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint blocked_dates_date_order_check check (end_date >= start_date),
  constraint blocked_dates_reason_not_blank_check check (length(btrim(reason)) > 0)
);

create index if not exists blocked_dates_venue_range_idx
  on public.blocked_dates (venue_id, start_date, end_date);

create index if not exists blocked_dates_active_range_idx
  on public.blocked_dates (start_date, end_date)
  where is_active;

alter table public.blocked_dates enable row level security;

drop policy if exists blocked_dates_active_select on public.blocked_dates;
create policy blocked_dates_active_select
  on public.blocked_dates
  for select
  using (
    is_active
    or exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists blocked_dates_admin_insert on public.blocked_dates;
create policy blocked_dates_admin_insert
  on public.blocked_dates
  for insert
  with check (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists blocked_dates_admin_update on public.blocked_dates;
create policy blocked_dates_admin_update
  on public.blocked_dates
  for update
  using (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_blocked_dates_updated_at on public.blocked_dates;
create trigger set_blocked_dates_updated_at
before update on public.blocked_dates
for each row
execute function public.set_updated_at();
