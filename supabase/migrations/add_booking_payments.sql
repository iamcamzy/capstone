create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  total_booking_amount numeric(12, 2) not null default 0 check (total_booking_amount >= 0),
  minimum_payment_amount numeric(12, 2) not null default 0 check (minimum_payment_amount >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  remaining_balance numeric(12, 2) not null default 0 check (remaining_balance >= 0),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid', 'refunded')),
  payment_method text,
  payment_notes text,
  payment_recorded_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_payments_status_idx
  on public.booking_payments(payment_status);
create index if not exists booking_payments_recorded_at_idx
  on public.booking_payments(payment_recorded_at);

insert into public.booking_payments (
  booking_id,
  total_booking_amount,
  minimum_payment_amount,
  amount_paid,
  remaining_balance,
  payment_status
)
select
  b.id,
  coalesce(b.total_price, 0),
  coalesce(b.minimum_payment_amount, coalesce(b.total_price, 0) * 0.5),
  0,
  coalesce(b.total_price, 0),
  'unpaid'
from public.bookings b
on conflict (booking_id) do nothing;

create or replace function public.initialize_booking_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.booking_payments (
    booking_id,
    total_booking_amount,
    minimum_payment_amount,
    remaining_balance
  ) values (
    new.id,
    coalesce(new.total_price, 0),
    coalesce(new.minimum_payment_amount, coalesce(new.total_price, 0) * 0.5),
    coalesce(new.total_price, 0)
  )
  on conflict (booking_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_booking_payment_after_insert on public.bookings;
create trigger initialize_booking_payment_after_insert
after insert on public.bookings
for each row execute function public.initialize_booking_payment();

alter table public.booking_payments enable row level security;

drop policy if exists "Admins can manage booking payments" on public.booking_payments;
create policy "Admins can manage booking payments"
on public.booking_payments
for all
to authenticated
using (exists (select 1 from public.admins where admins.id = auth.uid()))
with check (exists (select 1 from public.admins where admins.id = auth.uid()));

