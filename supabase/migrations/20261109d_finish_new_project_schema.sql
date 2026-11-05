do $$ begin
  revoke all on function public.public_signup_promoter(text, text, text, text, text) from public;
exception when undefined_function then null;
end $$;
do $$ begin
  revoke all on function public.public_signup_promoter(text, text, text, text, text, text) from public;
exception when undefined_function then null;
end $$;
grant execute on function public.public_signup_promoter(text, text, text, text, text, text) to anon, authenticated;

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
  select coalesce(sum(amount), 0)::numeric(12, 2) into v_raised from public.donations where employee_id = p_employee_id;
  select coalesce(sum(amount), 0)::numeric(12, 2) into v_paid from public.payouts where employee_id = p_employee_id;
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
revoke insert on public.payouts from authenticated;
grant select, update, delete on public.payouts to authenticated;
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
