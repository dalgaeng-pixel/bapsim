# Developer Notes

Last updated: 2026-07-27 KST

## Purpose

This file is the first stop for the next agent or developer continuing the project. Keep it updated whenever architecture, deployment, storage behavior, or operational assumptions change.

## Project Snapshot

- App name: 밥심 식사배달관리
- Local path: `C:\Users\이나라솔-PC\Desktop\앱개발\bapsim-meal-manager`
- Framework: Next.js 15, React 19, TypeScript, Tailwind CSS
- Current storage mode: **Supabase connected** (Server Components + Server Actions)
- Supabase project: `babsim` at `https://fnfdudfzasgaukpfmxkv.supabase.co`
- Supabase schema: base schema, RLS policies, and `docs/supabase-contact-groups-migration.sql` applied in the production SQL Editor on 2026-07-20 KST.
- PWA: manifest, service worker, installable HTTPS deployment prepared
- Production URL: `https://bapsim.vercel.app` (Deployed via Vercel)

## Architectural Changes & Optimizations (Recent)

- **Server-Side Rendering (SSR) & Initial State Injection**: Both the Admin (`/admin`) and Client (`/client/[code]`) pages are now Server Components. They fetch data directly from Supabase via `supabase-admin` and pass it as `initialState` to the Zustand store, completely eliminating initial loading spinners.
- **Granular State Sync (Diff)**: The old whole-state sync bridge (`/api/state`) was replaced by a Server Action (`syncAppStateDiffAction`). The client now calculates the diff (inserted, updated, deleted items) and sends only the changes to Supabase, vastly improving performance and saving bandwidth.
- **Persisted Delete Diff**: Client-side deletes now include `deleted` IDs in `AppStateDiff`, and `saveAppStateDiffToSupabase` applies matching Supabase `delete` operations before upserts. This fixes deleted test clients reappearing after refresh because SSR reloaded stale rows from Supabase.
- **Push Notification Toggle**: The admin header notification button now reflects browser push status (`on`, `off`, `blocked`, `unsupported`) and toggles push subscriptions on/off. `/api/push/subscribe` supports `DELETE` to remove server-side subscriptions when the admin turns notifications off.
- **Weekly Meal Scheduling**: The app now supports client-specific weekday default quantities by meal type, starting with lunch and dinner. Admins edit the `Mon-Sun x lunch/dinner` grid in each client form. Customers can only change date-specific orders, not the admin default table.
- **Date & Meal Selection**: The admin dashboard has `today / tomorrow / date input` and meal-type selectors. Customer pages show today/tomorrow cards plus a two-week weekly setting table.
- **Simple No-Meal Rules**: Monthly last-day, monthly day, and one-off date no-meal rules are stored through the existing `holidays` table using an encoded JSON payload in `name`. This avoids an immediate Supabase table migration while preserving structured parsing in `lib/schedule.ts`.
- **Meal Supply Type**: Each client has a `mealSupplyType` of `regular` or `lunchbox`. Admin overview totals, delivery CSV, monthly settlement rows, and client/admin profile displays split or label regular meal counts vs personal lunchboxes. The value is persisted in the same encoded internal client settings row in `holidays`.
- **Delivery Start Date**: Each client has a `deliveryStartDate`. Admins can enter meal defaults before actual service starts, but delivery tables and monthly settlement include normal orders only on/after that start date; explicit admin delivery corrections can record pre-start samples. The value is persisted as an encoded internal settings row in `holidays`, avoiding an immediate `clients` table migration.
- **Daily Monthly Settlement & Pricing**: Monthly settlement now lists and exports every delivery location by day, sorted by date and then delivery location, calculates each location subtotal from those daily quantities, and finishes each settlement account with one monthly final row. Legacy client-level monthly overrides do not alter location subtotals. The default unit price is 8,000 KRW; a monthly, account-level price is stored independently from the optional final-quantity override so daily quantities remain automatic when only price changes. All Excel buttons generate a real `.xlsx` file with width sized from Korean and Latin text length. Run `docs/supabase-monthly-settlement-pricing-migration.sql` before using persistent price edits in Supabase.
- **Daily Delivery Corrections**: Admins can record actual quantities for today or past dates from monthly settlement, including pre-start samples; the correction form uses a two-row responsive layout so quantity and memo inputs do not overlap. Each correction is marked and can be settlement-included or excluded. Excluded samples remain in correction history and XLSX exports but do not affect location subtotals, monthly final quantity, or amount. Run `docs/supabase-daily-delivery-corrections-migration.sql` once before using corrections with Supabase.
- **Client App Security (Dynamic Routing & Isolation)**: The generic `/client` route was replaced by a dynamic route `/client/[code]`. The server securely filters the global state and injects **only the specific client's data** into the browser. It is now impossible for one client to access another client's data.
- **Mobile Layout Optimization**: Prevented horizontal scrolling issues by removing fixed minimum widths (`min-w-[...]`) from tables, hiding non-essential columns on mobile, and ensuring long addresses wrap correctly with `break-all`.
- **Settlement Accounts & Contact Access Groups**: Delivery locations remain `clients`, while `settlement_accounts` controls admin-only monthly aggregation and `contact_access_groups` + members controls one shared customer link/PIN for one or more permitted locations. Delivery stays location based; monthly CSV and settlement rows are account based.
- **Contact-Group Server Verification**: Customer mutations use `syncContactAccessGroupDiffAction`, which verifies invite code, PIN, group status, and every supplied location membership before saving. Customer diff payloads cannot update client records, groups, schedules, settlement adjustments, routes, or audit logs.

## How To Run Locally

```bash
cd C:\Users\이나라솔-PC\Desktop\앱개발\bapsim-meal-manager
npm run dev
```

Local URLs:

- Main: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Client: `http://localhost:3000/client/CLIENT-01-XXXX` (Check Supabase or Admin Dashboard for invite codes)

## Test Login

- Admin: enter any phone number and any verification code with 4+ digits.
- Client: use PIN `1234` for the default test client.

## Verification Commands

Run these before handing off code changes:

```bash
npm run typecheck
npm run build
npm run test:supabase
npm audit --omit=dev
```

Expected current result:

- TypeScript passes.
- `npm run build` creates `.next/` (server mode build).
- `npm run test:supabase` shows all 10 tables with ✅.
- `npm audit --omit=dev` reports 0 vulnerabilities.

## Key Files

- `components/admin-dashboard.tsx`: admin UI, tabs, client management, monthly settlement, XLSX actions, and popup-free four-cards-per-A4 delivery printing through a temporary hidden frame.
- `components/client-app.tsx`: customer PIN login, multi-location selection for an authorized contact group, quantity change, rejection, profile change requests.
- `lib/schedule.ts`: shared scheduling rules for lunch/dinner defaults, weekday quantities, virtual daily orders, no-meal exception rules, and location-level monthly settlement quantities.
- `lib/export.ts`: standard XLSX writer with saved column widths; used by all Excel download actions. It includes automatic/manual status and settlement inclusion for delivery records.
- `lib/push-client.ts`: browser push support detection, permission handling, push subscribe/unsubscribe toggle.
- `lib/use-bapsim-store.ts`: main client-side state store, calculating state diffs including deleted IDs and syncing via Server Action. It includes admin-only save/reset operations for daily delivery corrections.
- `lib/supabase-state.ts`: maps app camelCase state to Supabase snake_case rows, including settlement accounts, contact access groups, members, and group settlement adjustments.
- `app/actions/state.ts`: Admin state diff Server Action.
- `app/actions/contact-state.ts`: customer contact diff Server Action with code/PIN and assigned-location verification.
- `components/group-manager.tsx`: admin settlement-account and contact-access-group management UI.
- `app/globals.css`: delivery print layout; delivery cards render four per A4 page with cut lines only when the delivery print button is used.
- `lib/contact-groups.ts`: group membership, legacy fallback, and client-state filtering helpers.
- `app/client/[code]/page.tsx`: Dynamic route resolving an active contact access group and injecting only its assigned delivery locations.
- `app/admin/page.tsx`: SSR entry point for the Admin Dashboard.
- `docs/supabase-schema.sql`: Supabase table schema for a new project.
- `docs/supabase-contact-groups-migration.sql`: required one-time migration for the existing production project.
- `docs/supabase-monthly-settlement-pricing-migration.sql`: required one-time migration before per-month unit prices can be persisted.
- `docs/supabase-rls-policies.sql`: RLS policies and service_role grants (applied).

## Data Model Summary

The app state currently contains:

- `clients`: delivery locations with address, delivery order, legacy invite fields, delivery start date, meal supply type, and `settlementAccountId`.
- `mealTypes`: meal categories, currently lunch and dinner.
- `defaultQuantities`: weekday and meal-type default quantities.
- `orders`: date-specific meal quantities and statuses.
- `orderChangeLogs`: quantity change history.
- `changeRequests`: late changes and company/contact update requests.
- `holidays`: global/client-specific holidays and encoded simple no-meal exception rules.
- `settlementAccounts`: billing and monthly-aggregation accounts, each with one or more delivery locations.
- `contactAccessGroups`: customer-facing link/PIN accounts and their assigned manager details.
- `contactAccessGroupMembers`: explicit allowed delivery locations per contact access group.
- `monthlyAdjustments`: admin-only monthly settlement quantity overrides and settlement-account monthly unit prices; default unit price is 8,000 KRW.
- `notifications`: in-app notification records.
- `auditLogs`: important admin action history.
- `deliveryOverrides`: per-day temporary delivery ordering.

## Settlement and Contact Groups (Implemented in Source)

- The accepted design is in `docs/contact-group-design.md`.
- Migration SQL is `docs/supabase-contact-groups-migration.sql`. **Run it in the production Supabase SQL Editor before using the group UI.** The current environment has no Supabase CLI or database connection credentials, so this step was not applied automatically.
- The migration creates one settlement account and one contact group per existing delivery location, preserving current links and PINs.
- After migration: create `한울상사` in `정산/담당자`, edit management office, warehouse, print room 1, and print room 3 to select that settlement account, then create one contact group for print rooms 1 and 3. Their former individual-group access is reassigned to the shared group.
- Delivery tables remain location based. Monthly settlement and CSV export aggregate by settlement account.
- 정산/담당자 deletion is guarded: reassign every delivery location before deleting a settlement account or contact group. Deleting an unassigned settlement account also deletes only its manual monthly settlement adjustments; deleting an unassigned contact group permanently invalidates its link and PIN.
- Required operation after deploying this change: run `docs/supabase-monthly-settlement-pricing-migration.sql` once in the production Supabase SQL Editor, then reload `/admin` to enable monthly price edits.
- `npm run typecheck` and `npm run build` passed after implementation. `npm run test:supabase` was not run because it performs an external service-role credential check.

## Next Recommended Work

1. Wire real admin phone OTP.
2. Add Web Push subscription and server-side notification delivery.

## Update Rule

Whenever future work changes behavior, deployment, storage, or setup:

- Update this file.
- Keep README focused on user-facing run/test instructions.
## Transaction Statements (Implemented in Source)

- `월별 집계` keeps the existing operations-facing settlement table and Excel export. A separate `거래명세표` tab in the same menu provides a customer-facing statement per settlement account and month.
- Statements aggregate all assigned delivery locations by date, displaying lunch and dinner quantities and amounts side by side. Only settlement-included daily orders are billed; samples are included when recorded as settlement-included.
- Transaction statements deliberately use daily actual-delivery quantities rather than the account-level monthly final-quantity override, because a monthly override cannot be allocated safely to a specific date or meal period. Correct the daily delivery record when the statement needs to change.
- Supplier profile fields are business name, business registration number, business address, phone, email, bank name, account number, and account holder. Receiver fields intentionally include only settlement account name and billing address.
- Settlement accounts now have a persistent default VAT-inclusive unit price (8,000 KRW by default) and billing address. Existing selected-month unit-price overrides continue to take precedence.
- Run `docs/supabase-transaction-statements-migration.sql` once in the production Supabase SQL Editor before saving supplier profile, billing address, or account default unit price in Supabase. The transaction statement preview and existing monthly settlement remain available before the migration.
- Customer-facing filtered state explicitly replaces the supplier profile with non-sensitive blanks, so supplier account number and business details are never delivered through customer links.
- Related design: `docs/transaction-statement-design.md`.

## A4 Transaction Statement Print Form (2026-07-20)

- The existing monthly settlement screen remains unchanged. The separate transaction-statement action now prints a bordered **A4 portrait** document through the existing hidden print frame.
- The printed detail table follows the formal form layout: date, item, unit, quantity, unit price, amount, and notes.
- A delivery date with both meals is represented by two item rows: `중식` and `석식`. It no longer uses separate lunch/dinner quantity and amount columns.
- The document includes recipient company and billing address, supplier business fields, VAT-inclusive total, lunch/dinner totals, grand total, bank account, and account holder.
- The print layout adds blank detail rows for short months and reduces row height for months with many meal rows so normal monthly statements remain on one A4 portrait page.
- The screen preview uses the same item-row arrangement; the browser print button is the authoritative A4 output.

## Location Tables and Transaction Remarks (2026-07-22)

- Transaction statements now preserve each delivery location instead of aggregating every location into one daily line. Lunch and dinner quantities share the same date row.
- A4 print layout adapts to the settlement account's location count: one location uses a full-width table; two use vertically stacked tables; three or four use a 2x2 grid. More than four locations continue on another A4 page in groups of four.
- Each location table prints date, lunch quantity, dinner quantity, amount, and one shared remark. Location subtotal and overall monthly totals remain visible.
- Admins can edit transaction-statement remarks in the statement preview. The print/PDF button is disabled until changed remarks are saved, so PDF output always uses saved data.
- Remarks are stored in transaction_statement_remarks, keyed by settlement account, client, and order date. They intentionally do not reuse order memo because normal virtual schedule days do not always have a stored order.
- Before using saved remarks in Supabase, run docs/supabase-transaction-statement-remarks-migration.sql once in the production Supabase SQL Editor.

## Delivery Print Copies (2026-07-27)

- Delivery printing now creates one A4 portrait page per delivery location instead of mixing locations on the same page.
- Each page repeats the identical delivery slip six times in a 2-column by 3-row layout. The delivery order number remains the same on all six copies for that location.
- The existing delivery details, cut borders, date, meal, quantity, address, and delivery memo remain unchanged.


## Contact Link Copy Guidance (2026-07-27)

- The settlement/contact-manager link copy action now includes the same ready-to-send customer guidance as the client link copy action: service message, access URL, and PIN.
- Its completion alert also confirms that the link, PIN, and guidance message can be pasted directly into KakaoTalk or another messenger.

## Overtime Meal Registration (2026-07-27)

- Customer contacts now have a dedicated overtime headcount menu for the current day only. They enter the additional dinner headcount with plus/minus controls or a numeric input, and can save again to correct it.
- A weekday zero entry is stored and notified to the administrator. Weekends and dates configured as dinner holidays are treated as zero automatically and cannot be registered.
- Overtime rows are stored separately in overtime_meal_entries; they do not alter the original meal-order record. Delivery views, delivery Excel, monthly settlement, and transaction statements add the entry to the relevant dinner quantity at calculation time.
- Every save creates an administrator notification and uses the existing server-side Web Push path. The Important Changes screen shows the selected date's overtime entries so the administrator can check the saved quantity.
- Run docs/supabase-overtime-meal-entries-migration.sql once in the production Supabase SQL Editor before deployment. Until the table exists, the customer menu displays a setup notice and does not save data.

## Per-Client Overtime Menu Visibility (2026-07-27)

- The overtime registration menu is now disabled by default for every delivery location, including existing clients.
- Administrators enable it per location in the client create/edit form with the `야근 인원 등록 사용` checkbox. The client card also displays whether the option is enabled.
- Only enabled locations receive the menu through a shared contact link. Both the client UI and the save routine enforce the setting, so a hidden or disabled location cannot submit overtime entries.
- The flag is persisted in the existing internal client-settings holiday row together with delivery start date and meal supply type; no additional Supabase SQL migration is required.

## Korean Holidays And Label Layout (2026-07-27)

- Korean legal public holidays and substitute holidays now set both lunch and dinner base quantities to `0`. The generated calendar covers 2024-2050 and corrects the full three-day Seollal and Chuseok periods; it is stored in `lib/korean-public-holidays.ts` for a small client bundle.
- The source generator is `scripts/generate-korean-public-holidays.mjs`, using `date-holidays` as a development dependency. Run `npm run generate:korean-holidays` after updating the package data or when holiday law changes.
- Admin `Settings > Holiday Management` registers a vacation or temporary public holiday by date range, all clients or selected delivery locations, and lunch/dinner selection. It writes existing `holidays` rows with an encoded `category`, so no Supabase migration is required. Registered entries can be deleted from the same panel.
- Client today/tomorrow sections now show a prominent date and weekday header. Weekends and legal or administrator-registered holidays use red styling and a clear label. Holidays are locked at zero for customer changes; administrator delivery corrections remain the path for actual exceptional deliveries.
- Delivery print now matches AL006 sheets: six slips in a 2x3 grid, each 99mm x 93mm, 2.5mm horizontal gap, 7mm vertical gap, 4.5mm side padding, and 2mm top/bottom padding. The dashed cut line remains for plain-A4 printing. Browser print should use A4, scale 100%, and margins none for label stock.
## Weekly Schedule Holiday Highlight (2026-07-27)

- The client `Weekly Schedule` table now applies the same calendar rule used by the today/tomorrow screen. Saturdays, Sundays, Korean public holidays, and administrator-registered closure days use a pale red row, red date and quantity styling, and a visible `주말` or holiday-name label.
- This is display-only: existing automatic zero-meal behavior and customer quantity editing rules are unchanged.
## Overtime Dinner Routing (2026-07-27)

- For delivery locations with overtime registration enabled, the client Today/Tomorrow and Weekly Schedule screens omit dinner. Dinner is managed only through the Overtime Headcount menu.
- When an enabled location has no overtime entry for a working day, delivery, settlement, and statement calculations use the most recent prior overtime registration, including an explicit `0` entry. Weekends and public or registered holidays remain `0` and never inherit a prior value.
- The Overtime Headcount screen shows a prominent warning with the exact fallback quantity and instructs the user to save `0` when there is no overtime.
## Client Header Restaurant Phone (2026-07-27)

- Only the customer client screen header now displays the restaurant phone number `031-798-3342` in large red text to the right of the logo. It uses a `tel:` link for direct phone calls.
- On narrow mobile screens, the logo title is hidden in that header only so the logo, phone number, and notification button do not overlap. Administrator and login headers are unchanged.
