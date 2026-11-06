-- Record a paid Stripe checkout once, then the donation alert fires with the amount.

create unique index if not exists donations_stripe_session_id_uidx
  on public.donations (stripe_session_id)
  where stripe_session_id is not null;

create or replace function public.record_stripe_donation(
  p_amount numeric,
  p_referral_code text default null,
  p_employee_id uuid default null,
  p_donor_label text default null,
  p_stripe_session_id text default null,
  p_stripe_payment_intent text default null
)
returns public.donations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.donations;
  v_emp uuid := p_employee_id;
  v_code text := nullif(trim(coalesce(p_referral_code, '')), '');
  v_session text := nullif(trim(coalesce(p_stripe_session_id, '')), '');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if v_session is not null then
    select * into v_row
    from public.donations
    where stripe_session_id = v_session
    limit 1;
    if found then
      return v_row;
    end if;
  end if;

  if v_emp is null and v_code is not null then
    select id into v_emp from public.employees where referral_code = v_code limit 1;
  end if;
  if v_code is null and v_emp is not null then
    select referral_code into v_code from public.employees where id = v_emp;
  end if;

  insert into public.donations (
    employee_id,
    referral_code,
    amount,
    donor_label,
    stripe_session_id,
    stripe_payment_intent
  )
  values (
    v_emp,
    v_code,
    p_amount,
    nullif(trim(coalesce(p_donor_label, '')), ''),
    v_session,
    nullif(trim(coalesce(p_stripe_payment_intent, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_stripe_donation(numeric, text, uuid, text, text, text) from public;
revoke all on function public.record_stripe_donation(numeric, text, uuid, text, text, text) from anon, authenticated;
grant execute on function public.record_stripe_donation(numeric, text, uuid, text, text, text) to service_role;
