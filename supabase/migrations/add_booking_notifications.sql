alter table public.customers
  add column if not exists email_notifications_enabled boolean not null default true,
  add column if not exists sms_notifications_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_notification_preferences_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_notification_preferences_check
      check (email_notifications_enabled or sms_notifications_enabled);
  end if;
end $$;

alter table public.bookings
  add column if not exists one_week_notice_sent_at timestamptz null;

do $$
declare
  status_constraint record;
begin
  for status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.bookings drop constraint %I', status_constraint.conname);
  end loop;
end $$;

update public.bookings
set status = 'booked',
    status_updated_at = coalesce(status_updated_at, updated_at, now()),
    updated_at = now()
where status = 'confirmed';

update public.bookings
set status = 'contract_signing',
    status_updated_at = coalesce(status_updated_at, updated_at, now()),
    updated_at = now()
where status = 'pending';

alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'contract_signing',
      'booked',
      'rescheduled',
      'cancelled',
      'completed'
    )
  );

