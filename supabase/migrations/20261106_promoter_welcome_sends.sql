-- One welcome SMS/MMS per promoter (service role writes from welcome-promoter Edge Function).
create table if not exists public.promoter_welcome_sends (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  channel text not null default 'sms',
  sent_at timestamptz not null default now()
);

alter table public.promoter_welcome_sends enable row level security;

revoke all on table public.promoter_welcome_sends from anon, authenticated;
grant all on table public.promoter_welcome_sends to service_role;
