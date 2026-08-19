-- Blocked-date actions are administrative booking-availability events and do
-- not necessarily belong to one booking. They identify the blocked date in
-- metadata while booking-specific events continue to carry booking_id.
alter table public.booking_audit_log
  alter column booking_id drop not null;

alter table public.booking_audit_log
  drop constraint if exists booking_audit_log_booking_id_fkey;

alter table public.booking_audit_log
  add constraint booking_audit_log_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete set null;

-- The admin booking screen is available to admins and active staff. Customers
-- intentionally receive no select policy for audit history.
drop policy if exists booking_audit_log_internal_select on public.booking_audit_log;
create policy booking_audit_log_internal_select
  on public.booking_audit_log
  for select
  using (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
    or exists (
      select 1
      from public.employees
      where employees.id = auth.uid()
        and employees.is_active
    )
  );

drop policy if exists booking_audit_log_staff_insert on public.booking_audit_log;
create policy booking_audit_log_staff_insert
  on public.booking_audit_log
  for insert
  with check (
    actor_type = 'staff'
    and actor_id = auth.uid()
    and exists (
      select 1
      from public.employees
      where employees.id = auth.uid()
        and employees.is_active
    )
  );
