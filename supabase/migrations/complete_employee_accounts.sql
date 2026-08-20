-- Bring databases that already ran add_employees.sql up to the complete
-- employee account schema. Employee accounts are created and managed through
-- admin-only server routes; public signup continues to create customers only.
alter table public.employees
  add column if not exists phone text null,
  add column if not exists created_by uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.employees'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    alter table public.employees
      add constraint employees_id_fkey
      foreign key (id) references auth.users(id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.employees'::regclass and attname = 'created_by')
      ]::smallint[]
  ) then
    alter table public.employees
      add constraint employees_created_by_fkey
      foreign key (created_by) references auth.users(id);
  end if;
end
$$;

alter table public.employees enable row level security;

-- Active employees may read only their own row so role detection works. All
-- record creation, changes, listing, and deletion remain admin-only.
drop policy if exists employees_self_select on public.employees;
create policy employees_self_select
  on public.employees
  for select
  using (id = auth.uid() and is_active);

drop policy if exists employees_admin_select on public.employees;
create policy employees_admin_select
  on public.employees
  for select
  using (exists (select 1 from public.admins where admins.id = auth.uid()));

drop policy if exists employees_admin_insert on public.employees;
create policy employees_admin_insert
  on public.employees
  for insert
  with check (exists (select 1 from public.admins where admins.id = auth.uid()));

drop policy if exists employees_admin_update on public.employees;
create policy employees_admin_update
  on public.employees
  for update
  using (exists (select 1 from public.admins where admins.id = auth.uid()))
  with check (exists (select 1 from public.admins where admins.id = auth.uid()));

drop policy if exists employees_admin_delete on public.employees;
create policy employees_admin_delete
  on public.employees
  for delete
  using (exists (select 1 from public.admins where admins.id = auth.uid()));
