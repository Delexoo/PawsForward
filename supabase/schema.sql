-- PawsForward schema (locked RLS + rate-limited RPCs)
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  payment_type text not null check (payment_type in ('cashapp', 'venmo', 'paypal', 'zelle', 'other')),
  referral_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete set null,
  referral_code text,
  amount numeric(12, 2) not null check (amount > 0),
  donor_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete set null,
  referral_code text,
  path text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  details text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists donations_created_at_idx on public.donations (created_at desc);
create index if not exists donations_referral_code_idx on public.donations (referral_code);
create index if not exists donations_employee_id_idx on public.donations (employee_id);
create index if not exists visits_created_at_idx on public.visits (created_at desc);
create index if not exists visits_country_idx on public.visits (country);
create index if not exists employees_referral_code_idx on public.employees (referral_code);

alter table public.employees enable row level security;
alter table public.donations enable row level security;
alter table public.visits enable row level security;
alter table public.data_deletion_requests enable row level security;

-- Authenticated admin policies
drop policy if exists "employees_all_auth" on public.employees;
create policy "employees_all_auth" on public.employees
  for all to authenticated using (true) with check (true);

drop policy if exists "donations_all_auth" on public.donations;
create policy "donations_all_auth" on public.donations
  for all to authenticated using (true) with check (true);

drop policy if exists "visits_all_auth" on public.visits;
create policy "visits_all_auth" on public.visits
  for all to authenticated using (true) with check (true);

drop policy if exists "deletion_select_auth" on public.data_deletion_requests;
create policy "deletion_select_auth" on public.data_deletion_requests
  for select to authenticated using (true);

drop policy if exists "deletion_insert_anon" on public.data_deletion_requests;
create policy "deletion_insert_anon" on public.data_deletion_requests
  for insert to anon, authenticated with check (true);

create or replace function private.resolve_employee_by_code(p_code text)
returns table (id uuid, first_name text, last_name text, referral_code text)
language sql
security definer
set search_path = public
as $$
  select e.id, e.first_name, e.last_name, e.referral_code
  from public.employees e
  where e.referral_code = nullif(trim(p_code), '')
  limit 1;
$$;

create or replace function public.resolve_employee_by_code(p_code text)
returns table (id uuid, first_name text, last_name text, referral_code text)
language sql
security definer
set search_path = public
as $$
  select * from private.resolve_employee_by_code(p_code);
$$;

create or replace function public.record_donation(
  p_amount numeric,
  p_referral_code text default null,
  p_employee_id uuid default null,
  p_donor_label text default null
)
returns public.donations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.donations;
  v_count int;
  v_emp uuid := p_employee_id;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if v_emp is null and nullif(trim(coalesce(p_referral_code, '')), '') is not null then
    select id into v_emp from public.employees where referral_code = trim(p_referral_code) limit 1;
  end if;

  select count(*) into v_count
  from public.donations
  where created_at > now() - interval '1 minute';

  if v_count >= 30 then
    raise exception 'Too many donations right now. Try again in a minute.';
  end if;

  insert into public.donations (employee_id, referral_code, amount, donor_label)
  values (v_emp, nullif(trim(p_referral_code), ''), p_amount, nullif(trim(p_donor_label), ''))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.record_visit(
  p_referral_code text default null,
  p_employee_id uuid default null,
  p_path text default null,
  p_city text default null,
  p_region text default null,
  p_country text default null
)
returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.visits;
  v_count int;
begin
  select count(*) into v_count
  from public.visits
  where created_at > now() - interval '1 minute';

  if v_count >= 60 then
    raise exception 'Too many visits right now.';
  end if;

  insert into public.visits (employee_id, referral_code, path, city, region, country)
  values (
    p_employee_id,
    nullif(trim(p_referral_code), ''),
    p_path,
    p_city,
    p_region,
    p_country
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.resolve_employee_by_code(text) from public;
grant execute on function public.resolve_employee_by_code(text) to anon, authenticated;
revoke all on function public.record_donation(numeric, text, uuid, text) from public;
grant execute on function public.record_donation(numeric, text, uuid, text) to anon, authenticated;
revoke all on function public.record_visit(text, uuid, text, text, text, text) from public;
grant execute on function public.record_visit(text, uuid, text, text, text, text) to anon, authenticated;

-- Admin CRUD requires a Supabase Auth session (authenticated role).
-- Public donate flow uses SECURITY DEFINER RPCs only (no direct table access for anon).
revoke all on public.employees from anon;
revoke all on public.donations from anon;
revoke all on public.visits from anon;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.donations to authenticated;
grant select, insert, update, delete on public.visits to authenticated;
grant select, insert on public.data_deletion_requests to anon, authenticated;
grant select, update on public.data_deletion_requests to authenticated;

drop policy if exists "employees_all_anon" on public.employees;
drop policy if exists "donations_all_anon" on public.donations;
drop policy if exists "visits_all_anon" on public.visits;

drop policy if exists "deletion_select_anon" on public.data_deletion_requests;
create policy "deletion_select_anon" on public.data_deletion_requests
  for select to anon using (true);
