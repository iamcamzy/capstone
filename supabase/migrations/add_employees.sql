create table if not exists public.employees (
  id uuid primary key references auth.users(id),
  email text null,
  first_name text null,
  last_name text null,
  phone text null,
  position text null,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_active_idx
  on public.employees (is_active);

alter table public.employees enable row level security;

drop policy if exists employees_self_select on public.employees;
create policy employees_self_select
  on public.employees
  for select
  using (id = auth.uid() and is_active);

drop policy if exists employees_admin_select on public.employees;
create policy employees_admin_select
  on public.employees
  for select
  using (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists employees_admin_insert on public.employees;
create policy employees_admin_insert
  on public.employees
  for insert
  with check (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists employees_admin_update on public.employees;
create policy employees_admin_update
  on public.employees
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

drop policy if exists employees_admin_delete on public.employees;
create policy employees_admin_delete
  on public.employees
  for delete
  using (
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

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();
