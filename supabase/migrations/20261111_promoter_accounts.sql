-- Promoter accounts: link a QR row to the person who verifies their email.
-- Operators keep full access. A signed-in promoter can only see their own rows
-- and can change only their payout method.

alter table public.employees
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists employees_user_id_idx
  on public.employees (user_id)
  where user_id is not null;

create table if not exists public.promoter_auth_sends (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.promoter_auth_sends enable row level security;
revoke all on table public.promoter_auth_sends from anon, authenticated;

create or replace function public.is_operator()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'operator';
$$;

revoke all on function public.is_operator() from public;
grant execute on function public.is_operator() to anon, authenticated;

create or replace function public.protect_employee_self_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_operator() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.referral_code is distinct from old.referral_code
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.avatar_url is distinct from old.avatar_url
     or new.created_at is distinct from old.created_at
  then
    raise exception 'You can only change your payout method.' using errcode = '42501';
  end if;
  if new.payment_type is null or new.payment_type not in (
    'cashapp','venmo','paypal','zelle','apple_cash','google_pay','chime','cash',
    'check','bank_transfer','wire','wise','revolut','stripe','square','bitcoin',
    'ethereum','usdc','paypal_friends','cashapp_business','apple_pay','other'
  ) then
    raise exception 'Choose a valid payment type.' using errcode = '22023';
  end if;
  if new.payment_handle is null
     or char_length(trim(new.payment_handle)) < 1
     or char_length(trim(new.payment_handle)) > 80
  then
    raise exception 'Enter a payout handle.' using errcode = '22023';
  end if;
  new.payment_handle := trim(new.payment_handle);
  return new;
end;
$$;

drop trigger if exists employees_protect_self_update on public.employees;
create trigger employees_protect_self_update
  before update on public.employees
  for each row
  execute function public.protect_employee_self_update();

create or replace function public.claim_promoter_profile()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_uid uuid := auth.uid();
  n integer := 0;
begin
  if v_uid is null or v_email = '' or public.is_operator() then
    return 0;
  end if;
  update public.employees
  set user_id = v_uid
  where lower(email) = v_email
    and (user_id is null or user_id = v_uid);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.claim_promoter_profile() from public;
grant execute on function public.claim_promoter_profile() to authenticated;

drop policy if exists "employees_all_auth" on public.employees;
drop policy if exists "donations_all_auth" on public.donations;
drop policy if exists "payouts_all_auth" on public.payouts;
drop policy if exists "visits_all_auth" on public.visits;

drop policy if exists employees_operator_all on public.employees;
drop policy if exists employees_self_select on public.employees;
drop policy if exists employees_self_update on public.employees;
drop policy if exists donations_operator_all on public.donations;
drop policy if exists donations_self_select on public.donations;
drop policy if exists payouts_operator_all on public.payouts;
drop policy if exists payouts_self_select on public.payouts;
drop policy if exists visits_operator_all on public.visits;
drop policy if exists visits_self_select on public.visits;

create policy employees_operator_all on public.employees
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

create policy employees_self_select on public.employees
  for select to authenticated
  using (user_id = auth.uid());

create policy employees_self_update on public.employees
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy donations_operator_all on public.donations
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

create policy donations_self_select on public.donations
  for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = donations.employee_id and e.user_id = auth.uid()
    )
  );

create policy payouts_operator_all on public.payouts
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

create policy payouts_self_select on public.payouts
  for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = payouts.employee_id and e.user_id = auth.uid()
    )
  );

create policy visits_operator_all on public.visits
  for all to authenticated
  using (public.is_operator())
  with check (public.is_operator());

create policy visits_self_select on public.visits
  for select to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.id = visits.employee_id and e.user_id = auth.uid()
    )
  );
