create extension if not exists pgcrypto;

create table if not exists public.comphony_runtime_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null,
  project_ref text not null,
  generated_at timestamptz not null default timezone('utc', now()),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists compony_runtime_snapshots_company_project_generated_idx
  on public.comphony_runtime_snapshots (company_slug, project_ref, generated_at desc);

create table if not exists public.comphony_events (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null,
  project_ref text not null,
  event_id text not null unique,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists compony_events_company_project_occurred_idx
  on public.comphony_events (company_slug, project_ref, occurred_at desc);

create table if not exists public.comphony_remote_inbox (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null,
  project_ref text not null,
  provider text not null,
  sender_id text not null,
  sender_name text,
  thread_id text,
  title text,
  body text not null,
  status text not null default 'received',
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

create index if not exists compony_remote_inbox_status_received_idx
  on public.comphony_remote_inbox (status, received_at desc);

alter table public.comphony_runtime_snapshots enable row level security;
alter table public.comphony_events enable row level security;
alter table public.comphony_remote_inbox enable row level security;

drop policy if exists "authenticated can read runtime snapshots" on public.comphony_runtime_snapshots;
create policy "authenticated can read runtime snapshots"
  on public.comphony_runtime_snapshots
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can read runtime events" on public.comphony_events;
create policy "authenticated can read runtime events"
  on public.comphony_events
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can read remote inbox" on public.comphony_remote_inbox;
create policy "authenticated can read remote inbox"
  on public.comphony_remote_inbox
  for select
  to authenticated
  using (true);

alter publication supabase_realtime add table public.comphony_runtime_snapshots;
alter publication supabase_realtime add table public.comphony_events;
alter publication supabase_realtime add table public.comphony_remote_inbox;
