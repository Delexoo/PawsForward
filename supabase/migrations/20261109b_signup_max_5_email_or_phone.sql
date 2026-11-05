-- Replace daily phone/email blocks with max 5 QRs per email and per phone.
alter table public.employees
  alter column phone drop not null;

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
  v_email_count int;
  v_phone_count int;
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

  -- Max 5 QRs for the same email.
  select count(*) into v_email_count
  from public.employees e
  where lower(coalesce(e.email, '')) = v_email;
  if v_email_count >= 5 then
    raise exception 'You''ve already created over 5 QR codes with these details. You''ve hit the limit.' using errcode = 'P0001';
  end if;

  -- Max 5 QRs for the same phone (when provided).
  if v_phone is not null then
    select count(*) into v_phone_count
    from public.employees e
    where coalesce(e.phone, '') = v_phone;
    if v_phone_count >= 5 then
      raise exception 'You''ve already created over 5 QR codes with these details. You''ve hit the limit.' using errcode = 'P0001';
    end if;
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

grant execute on function public.public_signup_promoter(text, text, text, text, text, text) to anon, authenticated;
