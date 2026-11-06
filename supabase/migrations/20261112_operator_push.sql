-- Send operator alerts the moment a QR, scan, or donation row is created.

create extension if not exists pg_net;

create table if not exists public.operator_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  notify_qr_created boolean not null default true,
  notify_qr_scanned boolean not null default true,
  notify_donation boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.operator_push_subscriptions enable row level security;
revoke all on table public.operator_push_subscriptions from anon;
grant select, insert, update, delete on table public.operator_push_subscriptions to authenticated;

drop policy if exists operator_push_all on public.operator_push_subscriptions;
create policy operator_push_all
  on public.operator_push_subscriptions
  for all
  to authenticated
  using (public.is_operator())
  with check (public.is_operator());

create or replace function private.enqueue_operator_push()
returns trigger
language plpgsql
security definer
set search_path = public, private, net
as $$
declare
  secret text;
  body jsonb;
  emp_name text;
  place text;
begin
  select value into secret from private.app_secrets where key = 'operator_push_secret';
  if secret is null or secret = '' then
    return new;
  end if;

  if tg_table_name = 'employees' then
    emp_name := left(trim(concat_ws(' ', new.first_name, new.last_name)), 80);
    body := jsonb_build_object(
      'kind', 'qr_created',
      'id', new.id,
      'name', coalesce(nullif(emp_name, ''), 'Someone')
    );
  elsif tg_table_name = 'visits' then
    select left(trim(concat_ws(' ', e.first_name, e.last_name)), 80) into emp_name
      from public.employees e
      where e.id = new.employee_id
         or (new.referral_code is not null and new.referral_code <> '' and e.referral_code = new.referral_code)
      limit 1;
    place := left(nullif(trim(concat_ws(', ',
      nullif(trim(coalesce(new.city, '')), ''),
      nullif(trim(coalesce(new.region, '')), '')
    )), ''), 80);
    body := jsonb_build_object(
      'kind', 'qr_scanned',
      'id', new.id,
      'name', coalesce(nullif(emp_name, ''), 'A QR code'),
      'place', place
    );
  elsif tg_table_name = 'donations' then
    select left(trim(concat_ws(' ', e.first_name, e.last_name)), 80) into emp_name
      from public.employees e
      where e.id = new.employee_id
      limit 1;
    body := jsonb_build_object(
      'kind', 'donation',
      'id', new.id,
      'name', nullif(emp_name, ''),
      'amount', new.amount
    );
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://fnkccwjoyfnackmdycti.supabase.co/functions/v1/operator-push',
      body := body,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', secret
      ),
      timeout_milliseconds := 5000
    );
  exception
    when others then
      raise warning 'operator push enqueue failed';
  end;
  return new;
end;
$$;

revoke all on function private.enqueue_operator_push() from public;
revoke all on function private.enqueue_operator_push() from anon, authenticated;

drop trigger if exists employees_operator_push on public.employees;
create trigger employees_operator_push
  after insert on public.employees
  for each row execute function private.enqueue_operator_push();

drop trigger if exists visits_operator_push on public.visits;
create trigger visits_operator_push
  after insert on public.visits
  for each row execute function private.enqueue_operator_push();

drop trigger if exists donations_operator_push on public.donations;
create trigger donations_operator_push
  after insert on public.donations
  for each row execute function private.enqueue_operator_push();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employees'
  ) then
    alter publication supabase_realtime add table public.employees;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits'
  ) then
    alter publication supabase_realtime add table public.visits;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'donations'
  ) then
    alter publication supabase_realtime add table public.donations;
  end if;
end $$;
