# Developer Notes

Last updated: 2026-06-26 09:15 KST

## Purpose

This file is the first stop for the next agent or developer continuing the project. Keep it updated whenever architecture, deployment, storage behavior, or operational assumptions change.

## Project Snapshot

- App name: 밥심 식사배달관리
- Local path: `C:\Users\이나라솔-PC\Desktop\앱개발\bapsim-meal-manager`
- Framework: Next.js 15, React 19, TypeScript, Tailwind CSS
- Current storage mode: **Supabase connected** (localStorage fallback if env vars missing)
- Supabase project: `babsim` at `https://fnfdudfzasgaukpfmxkv.supabase.co`
- Supabase schema: `docs/supabase-schema.sql` + `docs/supabase-rls-policies.sql` applied
- PWA: manifest, service worker, installable HTTPS deployment prepared
- Sites project ID: `appgprj_6a3db2f531688191acc48c3af9f4842c`
- Production URL: `https://bapsim-meal-delivery.workspace-398477.chatgpt-team.site`
- Current Sites access: custom/private for `dalgaeng@gmail.com`

## Important Current Caveats

- **`output: "export"` has been removed** from `next.config.mjs`. The app now runs in server mode for API route support.
- `/api/state` route is set to `force-dynamic` and queries Supabase on every request.
- The Supabase connection uses `service_role` key on the server side. This key must never be exposed to the browser.
- The whole-state sync bridge (`/api/state` POST) uploads the entire app state on every change. This works for MVP but should be replaced with granular server actions.
- For static Sites deployment, use `npm run build:static` instead of `npm run build`.
- Sites public internet publishing is disabled for the current workspace. The deployed Sites URL requires ChatGPT sign-in.
- For immediate no-login mobile testing, use localtunnel as a temporary HTTPS tunnel.

## How To Run Locally

```bash
cd C:\Users\이나라솔-PC\Desktop\앱개발\bapsim-meal-manager
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Local URLs:

- Main: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3000/admin`
- Client: `http://127.0.0.1:3000/client`

For same-Wi-Fi mobile browser testing:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Then open the PC LAN IP, currently documented as `http://192.168.0.106:3000`.

For temporary public HTTPS testing:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
npx --yes localtunnel --port 3000 --local-host 127.0.0.1
```

The localtunnel URL changes and only works while both processes are running.

## Test Login

- Admin: enter any phone number and any verification code with 4+ digits.
- Client: use PIN `1234`.

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

For static Sites build:

```bash
npm run build:static
```

- Creates `out/` and `dist/`.
- `dist/server/index.js` exists.

## Deployment Notes

Sites requires a pushed Git source state and a saved version before deployment.

Current successful deployment path:

1. Commit local changes.
2. Push to the Sites source repository using a short-lived credential from Sites.
3. Run `npm run build`.
4. Create archive:

```bash
tar -czf bapsim-sites-archive.tar.gz .openai dist
```

5. Save a Sites version with the archive and current commit SHA.
6. Deploy the saved version.

Do not persist source repository tokens in Git remotes or files. Use per-command Git auth headers only.

## Key Files

- `components/admin-dashboard.tsx`: admin UI, tabs, client management, delivery table, CSV actions.
- `components/client-app.tsx`: customer PIN login, quantity change, rejection, profile change requests.
- `lib/use-bapsim-store.ts`: main client-side state store, local/Supabase auto-detect bridge.
- `lib/seed.ts`: sample data, UUID-compatible IDs, default test client with PIN `1234`.
- `lib/supabase-state.ts`: maps app camelCase state to Supabase snake_case rows.
- `app/api/state/route.ts`: Next route handler for state load/save when server runtime is available.
- `scripts/prepare-dist.mjs`: converts Next static export to Sites-compatible `dist/server` + `dist/client` layout.
- `scripts/test-supabase.mjs`: Supabase connection and table verification script.
- `docs/supabase-schema.sql`: Supabase table schema (applied).
- `docs/supabase-rls-policies.sql`: RLS policies and service_role grants (applied).
- `docs/mobile-test.md`: mobile browser/PWA installation notes.

## Data Model Summary

The app state currently contains:

- `clients`: customer companies, addresses, manager contact, delivery order, invite code/PIN.
- `mealTypes`: meal categories, currently lunch only.
- `defaultQuantities`: weekday and meal-type default quantities.
- `orders`: date-specific meal quantities and statuses.
- `orderChangeLogs`: quantity change history.
- `changeRequests`: late changes and company/contact update requests.
- `holidays`: global or client-specific holidays.
- `notifications`: in-app notification records.
- `auditLogs`: important admin action history.
- `deliveryOverrides`: per-day temporary delivery ordering.

## Decisions To Preserve

- MVP deployment target is PWA, not native app.
- Customer auth is invite link/QR plus 4-digit PIN.
- Admin auth is planned as phone OTP, but currently mocked.
- Important changes are food rejection, 5+ count changes, or 20%+ quantity changes.
- Default quantity is separated from daily order state.
- Customer can request address/contact changes, but admin must approve them.
- Initial design excludes payment, invoice automation, menu display, and employee-level orders.

## Next Recommended Work

1. ~~Create a Supabase project and run schema SQL.~~ ✅ Done (2026-06-26)
2. ~~Add `.env.local` with Supabase credentials.~~ ✅ Done (2026-06-26)
3. Test the HTTPS URL on Android Chrome and iPhone Safari.
4. For no-login temporary testing, use localtunnel.
5. For stable customer testing, deploy to Vercel (supports server-mode Next.js with API routes).
6. Replace whole-state sync with granular server workflows:
   - create/update client
   - change quantity
   - submit/resolve request
   - acknowledge important order
   - delivery order override
7. Wire real admin phone OTP.
8. Generate customer invite link/QR flow.
9. Add Web Push subscription and server-side notification delivery.

## Update Rule

Whenever future work changes behavior, deployment, storage, or setup:

- Update this file.
- Update `docs/handoff-2026-06-26.md` only if the immediate next-step checklist changes.
- Keep README focused on user-facing run/test instructions.
