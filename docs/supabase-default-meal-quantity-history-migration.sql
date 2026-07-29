-- Run this once in the Supabase SQL Editor after the existing meal-management migrations.
-- Each weekly default set is stored with an effective start date so later changes do not
-- recalculate past delivery records, monthly settlement, or transaction statements.

create table if not exists public.default_meal_quantity_versions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  meal_type_id uuid not null references public.meal_types(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  quantity integer not null check (quantity >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, meal_type_id, weekday, effective_from)
);

-- Preserve the current defaults as the original schedule. New changes made in the app
-- will add another version with the administrator-selected effective start date.
insert into public.default_meal_quantity_versions (
  id,
  client_id,
  meal_type_id,
  weekday,
  quantity,
  effective_from
)
select
  id,
  client_id,
  meal_type_id,
  weekday,
  quantity,
  date '1900-01-01'
from public.default_meal_quantities
on conflict (id) do nothing;

create index if not exists default_meal_quantity_versions_lookup_idx
  on public.default_meal_quantity_versions (
    client_id,
    meal_type_id,
    weekday,
    effective_from desc
  );

alter table public.default_meal_quantity_versions enable row level security;

grant all on public.default_meal_quantity_versions to service_role;