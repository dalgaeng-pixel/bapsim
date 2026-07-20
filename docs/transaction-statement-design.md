# Transaction Statement Design

## Purpose

The existing monthly settlement screen remains the operations view for delivery quantities, corrections, and monthly settlement overrides. A separate `거래명세표` tab is added inside the same monthly menu for customer-facing billing documents.

## Confirmed Format

- One statement per settlement account and selected month.
- Delivery locations belonging to that settlement account are combined.
- One row per date, with lunch and dinner quantities and amounts side by side.
- Sample deliveries remain billable when they are marked settlement-included.
- The receiver section shows only company name and billing address. It intentionally omits receiver manager name, phone number, and business registration number.
- The supplier section includes business name, registration number, business address, phone, email, bank name, account number, and account holder.
- Amounts use VAT-inclusive unit prices. The normal default is 8,000 KRW, but each settlement account can have a different default price such as 7,000 KRW.

## Price Rules

1. `settlement_accounts.default_unit_price` is the ongoing account default.
2. `monthly_settlement_adjustments.unit_price` remains a selected-month exception.
3. The transaction statement resolves the monthly exception first, then the account default, then 8,000 KRW.

## Quantity Rules

- The document sums actual daily orders with `settlement_included !== false`.
- It does not use the existing account-level manual final-quantity override because that override cannot be allocated safely to a date, lunch, or dinner.
- If a past delivery needs correction, use the existing daily delivery correction panel first; the statement updates automatically.

## Storage

The migration `docs/supabase-transaction-statements-migration.sql` adds:

- `settlement_accounts.billing_address`
- `settlement_accounts.default_unit_price`
- single-row `supplier_profiles`

The page remains readable before migration, but supplier and settlement details cannot persist in Supabase until it is run.

## Outputs

- Browser preview and A4 print through a hidden iframe, avoiding popup-blocker failures.
- Separate `.xlsx` export. Existing delivery and monthly-settlement exports are unchanged.