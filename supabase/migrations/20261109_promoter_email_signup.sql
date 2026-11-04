-- Store promoter email; signup collects Name + email (last name optional/empty).
alter table public.employees
  add column if not exists email text;

create index if not exists employees_email_idx
  on public.employees (lower(email))
  where email is not null and email <> '';

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
  v_last text := nullif(trim(both from regexp_replace(coalesce(p_last_name, ''), E'[\u00A0]+', ' ', 'g')), '');
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_type text := lower(nullif(trim(coalesce(p_payment_type, '')), ''));
  v_handle text := nullif(trim(coalesce(p_payment_handle, '')), '');
  v_code text;
  v_count int;
  v_phone_count int;
  v_email_count int;
  v_row public.employees;
begin
  if v_first is null or char_length(v_first) < 1 then
    raise exception 'Enter a valid name.' using errcode = '22023';
  end if;
  if char_length(v_first) > 80 then
    raise exception 'Name is too long.' using errcode = '22023';
  end if;
  if v_last is not null and char_length(v_last) > 80 then
    raise exception 'Last name is too long.' using errcode = '22023';
  end if;
  if v_email is null
     or char_length(v_email) < 5
     or char_length(v_email) > 120
     or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
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

  select count(*) into v_email_count
  from public.employees e
  where lower(e.email) = v_email
    and e.created_at > now() - interval '1 day';
  if v_email_count >= 1 then
    raise exception 'This email already signed up today. Check your inbox or ask an operator for help.';
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
    v_first, coalesce(v_last, ''), v_email, v_phone, v_type, v_handle, v_code, null
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
