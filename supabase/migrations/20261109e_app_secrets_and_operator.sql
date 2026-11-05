-- Private secrets store for Edge Functions (service_role via SECURITY DEFINER only).
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on table private.app_secrets from public;
revoke all on table private.app_secrets from anon, authenticated;

create or replace function public.app_secret(p_key text)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    -- Edge Functions use service role; also allow when called with service key via PostgREST
    -- PostgREST sets request.jwt.claim.role
    if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  select s.value into v from private.app_secrets s where s.key = p_key;
  return v;
end;
$$;

revoke all on function public.app_secret(text) from public;
revoke all on function public.app_secret(text) from anon, authenticated;
grant execute on function public.app_secret(text) to service_role;

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
