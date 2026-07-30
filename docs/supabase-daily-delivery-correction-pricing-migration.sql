-- Run this once in the Supabase SQL Editor after the daily-delivery-corrections migration.
-- A non-empty unit_price is an administrator-entered special-meal price for that
-- delivery correction. Blank values continue to use the settlement account's normal price.

alter table public.daily_meal_orders
  add column if not exists unit_price integer check (unit_price >= 0);