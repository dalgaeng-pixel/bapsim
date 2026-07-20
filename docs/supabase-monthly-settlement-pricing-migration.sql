-- Run this once in the Supabase SQL Editor after contact-group migration.
-- It keeps manual monthly quantity overrides separate from the price used for each settlement month.

alter table public.monthly_settlement_adjustments
  alter column final_quantity drop not null;

alter table public.monthly_settlement_adjustments
  add column if not exists unit_price integer not null default 8000 check (unit_price >= 0);
