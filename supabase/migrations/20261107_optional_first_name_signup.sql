-- First name is optional on promoter signup / employee create.
create or replace function public.public_signup_promoter(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_payment_type text,
  p_payment_handle text
)
returns table (
  id uuid,
  first_name text,
  last_name text,
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
  v_first text := nullif(trim(coalesce(p_first_name, '')), '');
  v_last text := nullif(trim(coalesce(p_last_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_type text := lower(nullif(trim(coalesce(p_payment_type, '')), ''));
  v_handle text := nullif(trim(coalesce(p_payment_handle, '')), '');
  v_code text;
  v_count int;
  v_phone_count int;
  v_row public.employees;
begin
  if v_first is not null and char_length(v_first) > 80 then
    raise exception 'First name is too long.' using errcode = '22023';
  end if;
  if v_last is not null and char_length(v_last) > 80 then
    raise exception 'Last name is too long.' using errcode = '22023';
  end if;
  if v_phone is null or char_length(v_phone) < 7 or char_length(v_phone) > 40 then
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

  select count(*) into v_phone_count
  from public.employees e
  where e.phone = v_phone
    and e.created_at > now() - interval '1 day';
  if v_phone_count >= 1 then
    raise exception 'This phone already signed up today. Check with an operator if you need help.';
  end if;

  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    exit when not exists (
      select 1 from public.employees e where e.referral_code = v_code
    );
  end loop;

  insert into public.employees (
    first_name, last_name, phone, payment_type, payment_handle, referral_code, avatar_url
  ) values (
    coalesce(v_first, ''), coalesce(v_last, ''), v_phone, v_type, v_handle, v_code, null
  )
  returning * into v_row;

  id := v_row.id;
  first_name := v_row.first_name;
  last_name := v_row.last_name;
  referral_code := v_row.referral_code;
  payment_type := v_row.payment_type;
  payment_handle := v_row.payment_handle;
  created_at := v_row.created_at;
  return next;
end;
$$;
