-- Run this once in the Supabase SQL Editor after the current monthly-settlement migrations.
-- It preserves every existing daily order. New columns identify administrator-entered
-- actual-delivery corrections and whether each corrected delivery is billable.

alter table public.daily_meal_orders
  add column if not exists is_admin_correction boolean not null default false,
  add column if not exists settlement_included boolean not null default true;

create index if not exists daily_meal_orders_admin_correction_date_idx
  on public.daily_meal_orders (order_date desc, client_id, meal_type_id)
  where is_admin_correction;
