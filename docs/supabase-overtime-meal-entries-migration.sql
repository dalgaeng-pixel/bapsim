-- Run once in the Supabase SQL Editor before using the overtime meal feature.
-- Customer contacts can register the current day's additional dinner headcount,
-- including zero, and administrators receive a notification for every save.

create table if not exists public.overtime_meal_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  order_date date not null,
  quantity integer not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, order_date)
);

create index if not exists overtime_meal_entries_date_client_idx
  on public.overtime_meal_entries (order_date desc, client_id);

alter table public.overtime_meal_entries enable row level security;

grant all on public.overtime_meal_entries to service_role;