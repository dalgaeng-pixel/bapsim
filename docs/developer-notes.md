# Developer Notes

Last updated: 2026-07-20 KST

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
- **Delivery Start Date**: Each client has a `deliveryStartDate`. Admins can enter meal defaults before actual service starts, but delivery tables and monthly settlement include orders only on/after that start date. The value is persisted as an encoded internal settings row in `holidays`, avoiding an immediate `clients` table migration.
- **Daily Monthly Settlement & Pricing**: Monthly settlement now lists and exports every delivery location by day, adds a location subtotal, and finishes each settlement account with one monthly final row. The default unit price is 8,000 KRW; a monthly, account-level price is stored independently from the optional final-quantity override so daily quantities remain automatic when only price changes. All Excel buttons generate a real `.xlsx` file with width sized from Korean and Latin text length. Run `docs/supabase-monthly-settlement-pricing-migration.sql` before using persistent price edits in Supabase.
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

- `components/admin-dashboard.tsx`: admin UI, tabs, client management, monthly settlement, XLSX actions, and dedicated four-cards-per-A4 delivery print window.
- `components/client-app.tsx`: customer PIN login, multi-location selection for an authorized contact group, quantity change, rejection, profile change requests.
- `lib/schedule.ts`: shared scheduling rules for lunch/dinner defaults, weekday quantities, virtual daily orders, no-meal exception rules, and location-level monthly settlement quantities.
- `lib/export.ts`: standard XLSX writer with saved column widths; used by all Excel download actions.
- `lib/push-client.ts`: browser push support detection, permission handling, push subscribe/unsubscribe toggle.
- `lib/use-bapsim-store.ts`: main client-side state store, calculating state diffs including deleted IDs and syncing via Server Action.
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
