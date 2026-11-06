-- The sign-in function links a QR row as the service role. That update
-- was denied because is_operator() is not executable by service_role,
-- and a promoter cannot set their own user_id through the self-update guard.

grant execute on function public.is_operator() to service_role;

create or replace function public.protect_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if public.is_operator() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     and not (
       new.user_id = auth.uid()
       and (old.user_id is null or old.user_id = auth.uid())
     )
  then
    raise exception 'You can only change your payout method.' using errcode = '42501';
  end if;

  if new.id is distinct from old.id
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
