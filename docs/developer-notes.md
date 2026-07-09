# Developer Notes

Last updated: 2026-07-09 KST

## Purpose

This file is the first stop for the next agent or developer continuing the project. Keep it updated whenever architecture, deployment, storage behavior, or operational assumptions change.

## Project Snapshot

- App name: 밥심 식사배달관리
- Local path: `C:\Users\이나라솔-PC\Desktop\앱개발\bapsim-meal-manager`
- Framework: Next.js 15, React 19, TypeScript, Tailwind CSS
- Current storage mode: **Supabase connected** (Server Components + Server Actions)
- Supabase project: `babsim` at `https://fnfdudfzasgaukpfmxkv.supabase.co`
- Supabase schema: `docs/supabase-schema.sql` + `docs/supabase-rls-policies.sql` applied
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
- **Client App Security (Dynamic Routing & Isolation)**: The generic `/client` route was replaced by a dynamic route `/client/[code]`. The server securely filters the global state and injects **only the specific client's data** into the browser. It is now impossible for one client to access another client's data.
- **Mobile Layout Optimization**: Prevented horizontal scrolling issues by removing fixed minimum widths (`min-w-[...]`) from tables, hiding non-essential columns on mobile, and ensuring long addresses wrap correctly with `break-all`.

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

- `components/admin-dashboard.tsx`: admin UI, tabs, client management, delivery table, CSV actions.
- `components/client-app.tsx`: customer PIN login, quantity change, rejection, profile change requests.
- `lib/schedule.ts`: shared scheduling rules for lunch/dinner defaults, weekday quantities, virtual daily orders, and no-meal exception rules.
- `lib/push-client.ts`: browser push support detection, permission handling, push subscribe/unsubscribe toggle.
- `lib/use-bapsim-store.ts`: main client-side state store, calculating state diffs including deleted IDs and syncing via Server Action.
- `lib/supabase-state.ts`: maps app camelCase state to Supabase snake_case rows and applies diff upserts/deletes.
- `app/actions/state.ts`: Server Actions for receiving diffs and securely updating Supabase.
- `app/client/[code]/page.tsx`: Dynamic route for client app, featuring strict server-side data isolation.
- `app/admin/page.tsx`: SSR entry point for the Admin Dashboard.
- `docs/supabase-schema.sql`: Supabase table schema (applied).
- `docs/supabase-rls-policies.sql`: RLS policies and service_role grants (applied).

## Data Model Summary

The app state currently contains:

- `clients`: customer companies, addresses, manager contact, delivery order, invite code/PIN.
- `mealTypes`: meal categories, currently lunch and dinner.
- `defaultQuantities`: weekday and meal-type default quantities.
- `orders`: date-specific meal quantities and statuses.
- `orderChangeLogs`: quantity change history.
- `changeRequests`: late changes and company/contact update requests.
- `holidays`: global/client-specific holidays and encoded simple no-meal exception rules.
- `notifications`: in-app notification records.
- `auditLogs`: important admin action history.
- `deliveryOverrides`: per-day temporary delivery ordering.

## Next Recommended Work

1. Wire real admin phone OTP.
2. Add Web Push subscription and server-side notification delivery.

## Update Rule

Whenever future work changes behavior, deployment, storage, or setup:

- Update this file.
- Keep README focused on user-facing run/test instructions.
