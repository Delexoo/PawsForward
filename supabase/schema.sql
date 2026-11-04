-- PawsForward schema (locked RLS + rate-limited RPCs)
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  payment_type text not null check (payment_type in (
    'cashapp','venmo','paypal','zelle','apple_cash','google_pay','chime','cash',
    'check','bank_transfer','wire','wise','revolut','stripe','square','bitcoin',
    'ethereum','usdc','paypal_friends','cashapp_business','apple_pay','other'
  )),
  payment_handle text,
  referral_code text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete cascade,
  referral_code text,
  amount numeric(12, 2) not null check (amount > 0),
  donor_label text,
  stripe_session_id text,
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete cascade,
  referral_code text,
  path text,
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

-- Commission payouts already sent to employees (owed = commission − paid).
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
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
create index if not exists payouts_employee_id_idx on public.payouts (employee_id);
create index if not exists payouts_created_at_idx on public.payouts (created_at desc);

alter table public.employees enable row level security;
alter table public.donations enable row level security;
alter table public.visits enable row level security;
alter table public.payouts enable row level security;
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

drop policy if exists "payouts_all_anon" on public.payouts;

drop policy if exists "payouts_all_auth" on public.payouts;
create policy "payouts_all_auth" on public.payouts
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

create or replace function public.public_signup_promoter(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_payment_type text,
  p_payment_handle text,
  p_email text default null
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  referral_code text,
  payment_type text,
  payment_handle text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := nullif(trim(both from regexp_replace(coalesce(p_first_name, ''), E'[\u00A0]+', ' ', 'g')), '');
  v_last text := coalesce(nullif(trim(both from regexp_replace(coalesce(p_last_name, ''), E'[\u00A0]+', ' ', 'g')), ''), '');
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_type text := lower(nullif(trim(coalesce(p_payment_type, '')), ''));
  v_handle text := nullif(trim(coalesce(p_payment_handle, '')), '');
  v_code text;
  v_count int;
  v_dup_count int;
  v_row public.employees;
begin
  if v_first is null or char_length(v_first) < 1 then
    raise exception 'Enter a valid first name.' using errcode = '22023';
  end if;
  if char_length(v_first) > 80 then
    raise exception 'First name is too long.' using errcode = '22023';
  end if;
  if char_length(v_last) > 80 then
    raise exception 'Last name is too long.' using errcode = '22023';
  end if;
  if v_email is null
     or char_length(v_email) < 5
     or char_length(v_email) > 120
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if v_phone is not null and (char_length(v_phone) < 7 or char_length(v_phone) > 40) then
    raise exception 'Enter a valid phone number.' using errcode = '22023';
  end if;
  if v_type is null or v_type not in (
    'cashapp','venmo','paypal','zelle','apple_cash','google_pay','chime','cash',
    'check','bank_transfer','wire','wise','revolut','stripe','square','bitcoin',
    'ethereum','usdc','paypal_friends','cashapp_business','apple_pay','other'
  ) then
    raise exception 'Choose a valid payment type.' using errcode = '22023';
  end if;
  if v_handle is null or char_length(v_handle) > 80 then
    raise exception 'Enter a payout handle.' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.employees e
  where e.created_at > now() - interval '1 minute';
  if v_count >= 8 then
    raise exception 'Too many signups right now. Try again in a minute.';
  end if;

  select count(*) into v_dup_count
  from public.employees e
  where e.first_name = v_first
    and coalesce(e.last_name, '') = v_last
    and lower(coalesce(e.email, '')) = v_email
    and coalesce(e.phone, '') = coalesce(v_phone, '')
    and e.payment_type = v_type
    and e.payment_handle = v_handle;
  if v_dup_count >= 5 then
    raise exception 'You''ve already created over 5 QR codes with these details. You''ve hit the limit.' using errcode = 'P0001';
  end if;

  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    exit when not exists (
      select 1 from public.employees e where e.referral_code = v_code
    );
  end loop;

  insert into public.employees (
    first_name, last_name, email, phone, payment_type, payment_handle, referral_code, avatar_url
  ) values (
    v_first, v_last, v_email, v_phone, v_type, v_handle, v_code, null
  )
  returning * into v_row;

  id := v_row.id;
  first_name := v_row.first_name;
  last_name := v_row.last_name;
  email := v_row.email;
  referral_code := v_row.referral_code;
  payment_type := v_row.payment_type;
  payment_handle := v_row.payment_handle;
  created_at := v_row.created_at;
  return next;
end;
$$;

revoke all on function public.resolve_employee_by_code(text) from public;
grant execute on function public.resolve_employee_by_code(text) to anon, authenticated;
revoke all on function public.record_donation(numeric, text, uuid, text) from public;
grant execute on function public.record_donation(numeric, text, uuid, text) to anon, authenticated;
revoke all on function public.record_visit(text, uuid, text, text, text, text) from public;
grant execute on function public.record_visit(text, uuid, text, text, text, text) to anon, authenticated;
revoke all on function public.public_signup_promoter(text, text, text, text, text) from public;
grant execute on function public.public_signup_promoter(text, text, text, text, text) to anon, authenticated;

-- Atomic payout: check remaining commission and insert in one transaction.
-- Commission rate matches SITE_CONFIG.commissionRate (0.5).
-- SECURITY DEFINER so inserts go through this gate only (direct insert revoked below).
create or replace function public.record_employee_payout(
  p_employee_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate constant numeric := 0.5;
  v_raised numeric(12, 2);
  v_paid numeric(12, 2);
  v_owed numeric(12, 2);
  v_row public.payouts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_employee_id is null then
    raise exception 'Employee is required' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter at least $0.01.' using errcode = '22023';
  end if;

  perform 1 from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Employee not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0)::numeric(12, 2) into v_raised
  from public.donations
  where employee_id = p_employee_id;

  select coalesce(sum(amount), 0)::numeric(12, 2) into v_paid
  from public.payouts
  where employee_id = p_employee_id;

  v_owed := round(v_raised * v_rate - v_paid, 2);

  if round(p_amount, 2) > v_owed then
    raise exception 'Amount exceeds owed balance ($%).', v_owed using errcode = 'P0001';
  end if;

  insert into public.payouts (employee_id, amount, note)
  values (p_employee_id, round(p_amount, 2), nullif(trim(coalesce(p_note, '')), ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_employee_payout(uuid, numeric, text) from public;
grant execute on function public.record_employee_payout(uuid, numeric, text) to authenticated;
-- Block direct client inserts; payouts must use record_employee_payout.
revoke insert on public.payouts from authenticated;
grant select, update, delete on public.payouts to authenticated;

-- Admin CRUD requires a Supabase Auth session (authenticated role).
-- Public donate flow uses SECURITY DEFINER RPCs only (no direct table access for anon).
revoke all on public.employees from anon;
revoke all on public.donations from anon;
revoke all on public.visits from anon;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.donations to authenticated;
grant select, insert, update, delete on public.visits to authenticated;
revoke all on public.payouts from anon;
revoke insert on public.payouts from authenticated;
grant select, update, delete on public.payouts to authenticated;
grant select, insert on public.data_deletion_requests to anon, authenticated;
grant select, update on public.data_deletion_requests to authenticated;

drop policy if exists "employees_all_anon" on public.employees;
drop policy if exists "donations_all_anon" on public.donations;
drop policy if exists "visits_all_anon" on public.visits;
drop policy if exists "payouts_all_anon" on public.payouts;
drop policy if exists "deletion_select_anon" on public.data_deletion_requests;

create table if not exists public.operator_login_events (
  id uuid primary key default gen_random_uuid(),
  ok boolean not null,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.operator_login_events enable row level security;
revoke all on table public.operator_login_events from anon, authenticated;
