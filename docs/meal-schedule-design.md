# Meal Schedule Design

Last updated: 2026-07-09 KST

## Understanding Summary

- Admins own the default contract-style meal settings for each client.
- Defaults are managed as `weekday x meal type` quantities, currently lunch and dinner.
- Quantity `0` means the client does not eat that meal slot.
- Customer contacts can change only date-specific orders, not the admin default table.
- Customer contacts can edit this week and next week in a single weekly table, then save changes in bulk.
- Admins can view operations by selected date and selected meal type.
- Simple no-meal rules cover monthly last day, monthly fixed day, and one specific date.
- A client can be configured before actual service starts, but settlement starts only from `deliveryStartDate`.
- Admins can manually correct monthly settlement totals without changing the original daily order history.

## Decisions

- **No-meal data remains auditable**: orders are still represented with `0` quantity and `holiday` status, so monthly reports can explain missing deliveries.
- **Admin defaults stay separate from customer changes**: `default_meal_quantities` remains the source for recurring defaults, while `daily_meal_orders` stores date-specific customer changes.
- **Meal types stay extensible**: lunch and dinner are seeded defaults, but the existing `meal_types` table still allows future meal categories.
- **No immediate new Supabase table**: simple no-meal rules are stored in the existing `holidays` table with encoded JSON in `name`, decoded/encoded only through `lib/schedule.ts`. This reduces migration risk for the current deployed app.
- **Shared calculation layer**: both admin and client UI use `lib/schedule.ts` to prevent mismatches between displayed defaults, generated orders, and exception rules.
- **Delivery start controls settlement**: entered defaults and prepared orders can exist before service starts, but delivery tables and monthly settlement filter out dates before each client's `deliveryStartDate`.
- **Settlement overrides do not mutate orders**: monthly corrections are stored separately as `monthlyAdjustments`, so order history remains auditable.

## Current Implementation

- `lib/schedule.ts` normalizes missing lunch/dinner meal types, fills missing weekday defaults, builds virtual daily orders, and evaluates no-meal rules.
- Admin client forms include a `Mon-Sun x lunch/dinner` quantity table and exception rule editor.
- Customer pages include today/tomorrow quick cards and a two-week weekly settings table.
- Saving a customer weekly change creates or updates the related `daily_meal_orders` row. If a slot is already past cutoff, it creates an approval request instead.
- Delivery start date is exposed on the client object in TypeScript but persisted through an encoded internal row in `holidays`, because the current deployed Supabase schema does not require a `clients.delivery_start_date` migration.
- Monthly settlement is selected by `YYYY-MM`. Each client row shows computed base/final totals, editable settlement final quantity, and memo. Overrides are persisted through encoded internal `holidays` rows until a dedicated table is introduced.

## Future Migration Option

When recurring exceptions become more complex, replace the encoded `holidays.name` rule payload with a dedicated table:

```sql
create table public.meal_exception_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  rule_type text not null,
  specific_date date,
  month_day smallint,
  meal_type_ids uuid[] not null,
  name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
```

At that point, update only `lib/schedule.ts` and `lib/supabase-state.ts` mapping logic first.
