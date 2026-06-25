# Developer Notes

Last updated: 2026-06-26

## Purpose

This file is the first stop for the next agent or developer continuing the project. Keep it updated whenever architecture, deployment, storage behavior, or operational assumptions change.

## Project Snapshot

- App name: 밥심 식사배달관리
- Local path: `C:\Users\이나라솔-PC\Desktop\앱개발\bapsim-meal-manager`
- Framework: Next.js 15, React 19, TypeScript, Tailwind CSS
- Current storage mode: localStorage-first MVP
- Supabase: schema and mapping code prepared, not connected to a real project yet
- PWA: manifest, service worker, installable HTTPS deployment prepared
- Sites project ID: `appgprj_6a3db2f531688191acc48c3af9f4842c`
- Production URL: `https://bapsim-meal-delivery.workspace-398477.chatgpt-team.site`
- Current Sites access: custom/private for `dalgaeng@gmail.com`

## Important Current Caveats

- The production Sites deployment is a static PWA build. It is suitable for mobile install testing and UI flow testing.
- Because the Sites deployment is static, `/api/state` is handled by the generated worker fallback and returns local mode. Real Supabase writes are not active in the deployed app yet.
- The local dev app can still run the Next route handler version of `/api/state`.
- For real production DB persistence, either use a deployment target that supports Next server routes or replace the whole-state sync bridge with explicit server actions/API endpoints on the chosen backend.
- Sites does not accept SVG/PNG files as worker modules at the archive root. The build script therefore emits:
  - `dist/server/index.js` as the worker entrypoint
  - `dist/client/*` as static assets
- Sites public internet publishing is disabled for the current workspace. The deployed Sites URL requires ChatGPT sign-in unless access policy changes become available.
- For immediate no-login mobile testing, use localtunnel as a temporary HTTPS tunnel. Example URL generated during testing: `https://fine-pears-exist.loca.lt`.

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
npm audit --omit=dev
```

Expected current result:

- TypeScript passes.
- Build creates `out/` and `dist/`.
- `dist/server/index.js` exists.
- `npm audit --omit=dev` reports 0 vulnerabilities.

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
- `docs/supabase-schema.sql`: target Supabase schema.
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

1. Test the HTTPS URL on Android Chrome and iPhone Safari.
2. For no-login temporary testing, use localtunnel.
3. For stable customer testing, choose a public hosting provider such as Vercel, Netlify, or Cloudflare Pages.
4. Create a Supabase project and run `docs/supabase-schema.sql`.
5. Add `.env.local` locally and production env vars in the deployment platform.
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
