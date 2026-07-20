# Daily Delivery Corrections Design

## Confirmed Requirements

- Only administrators can correct actual delivery quantities for today or past dates.
- The correction records the final delivered quantity, not a plus/minus adjustment.
- The correction form belongs in the monthly settlement view.
- A memo is optional and becomes `관리자 보정` when blank.
- Each correction chooses whether it is included in settlement. Samples can be excluded from settlement while remaining visible in delivery history and Excel exports.
- Reset restores the automatic weekday quantity for that slot.
- Customer links do not show corrections and do not receive notifications.

## Chosen Approach

Extend `daily_meal_orders` instead of creating a second delivery-record table.

Two persisted fields are added:

- `is_admin_correction`: marks an administrator-entered actual-delivery value.
- `settlement_included`: controls whether a corrected delivery contributes to monthly quantities and price.

This preserves the existing unique date/client/meal slot and keeps delivery, monthly settlement, and exports based on the same data source.

## Behavior

1. Saving a correction materializes or updates the date/client/meal daily order, bypassing customer cutoff handling.
2. Corrected orders can be recorded before a client's normal delivery-start date, which supports samples and one-off deliveries.
3. Billable settlement calculations include normal orders and corrections with `settlement_included = true`.
4. Excluded corrections are visible as `정산 제외` delivery records but contribute zero to location subtotals, monthly final quantity, and amount.
5. Reset removes the stored correction order. The date then resolves to the automatic default quantity again.
6. Each save or reset adds an administrator audit entry. Save also records an admin order change log.

## Operational Constraints

- The application targets approximately ten delivery locations and updates immediately after save.
- The feature is admin-only; no new customer data or access path is introduced.
- Supabase persistence requires running `supabase-daily-delivery-corrections-migration.sql` before using corrections in production. The UI remains disabled in Supabase mode until the columns are available.
- The migration is additive and does not alter existing quantities or settlement records.

## Decision Log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Correct today and past dates only | Past-only, all dates | Future changes already use customer planning flows. |
| Enter final quantity | Delta entry | Final quantity is less error-prone during reconciliation. |
| Put correction UI in monthly settlement | Separate menu | Corrections and settlement impact can be checked together. |
| Per-record settlement inclusion | Always include or exclude samples | Supports paid additions and free samples without losing history. |
| Extend daily orders | Separate actual-delivery table | Reuses current storage, aggregation, delivery, and export paths at the current scale. |
