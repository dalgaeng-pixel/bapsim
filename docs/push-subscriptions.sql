create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Only service_role can access this directly for now, no RLS policies needed if accessed server-side
