-- PawsForward schema: employees, donations, visits
-- Apply via Supabase MCP apply_migration or SQL editor.

create extension if not exists pgcrypto;

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

create index if not exists donations_created_at_idx on public.donations (created_at desc);
create index if not exists donations_referral_code_idx on public.donations (referral_code);
create index if not exists donations_employee_id_idx on public.donations (employee_id);
create index if not exists visits_created_at_idx on public.visits (created_at desc);
create index if not exists visits_country_idx on public.visits (country);
create index if not exists employees_referral_code_idx on public.employees (referral_code);

alter table public.employees enable row level security;
alter table public.donations enable row level security;
alter table public.visits enable row level security;

-- v1 open policies (anon admin + public donate). Tighten with auth later.
drop policy if exists "employees_select_anon" on public.employees;
create policy "employees_select_anon" on public.employees for select to anon, authenticated using (true);

drop policy if exists "employees_insert_anon" on public.employees;
create policy "employees_insert_anon" on public.employees for insert to anon, authenticated with check (true);

drop policy if exists "employees_update_anon" on public.employees;
create policy "employees_update_anon" on public.employees for update to anon, authenticated using (true) with check (true);

drop policy if exists "employees_delete_anon" on public.employees;
create policy "employees_delete_anon" on public.employees for delete to anon, authenticated using (true);

drop policy if exists "donations_select_anon" on public.donations;
create policy "donations_select_anon" on public.donations for select to anon, authenticated using (true);

drop policy if exists "donations_insert_anon" on public.donations;
create policy "donations_insert_anon" on public.donations for insert to anon, authenticated with check (true);

drop policy if exists "visits_select_anon" on public.visits;
create policy "visits_select_anon" on public.visits for select to anon, authenticated using (true);

drop policy if exists "visits_insert_anon" on public.visits;
create policy "visits_insert_anon" on public.visits for insert to anon, authenticated with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.employees to anon, authenticated;
grant select, insert on public.donations to anon, authenticated;
grant select, insert on public.visits to anon, authenticated;
