# Supabase Setup

## 1. Create project

Create a Supabase project, then copy these values into `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Use `.env.example` as the template.

## 2. Create schema

Open Supabase SQL Editor and run:

```sql
-- contents of docs/supabase-schema.sql
```

The schema stores clients, meal types, default quantities, daily orders, change logs, requests, holidays, devices, notifications, and admin audit logs.

## 3. Upgrade an existing production project

For the deployed project that already has data, run the full contents of:

```sql
-- docs/supabase-contact-groups-migration.sql
```

in Supabase SQL Editor once. This migration preserves every existing client link and PIN by creating a matching one-location settlement account and contact access group. It also adds the tables required for shared contact links and settlement-account monthly aggregation.

After it succeeds, reload `/admin` and use `정산/담당자` to create or combine groups. Do not use the new group UI before this migration is applied.

## 4. Auth plan

Admin login should use phone OTP. Supabase JS supports client initialization with `createClient` and OTP login through `signInWithOtp`.

Customer access remains separate from Supabase user accounts for MVP: invite link plus 4-digit PIN maps to a `contact_access_groups` row. Server-side mutation checks verify the code, PIN, active group, and assigned delivery location.

## 5. Security note

RLS is enabled in the schema. Production data access should go through server actions or route handlers that use verified admin/customer context. Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## 6. Current app behavior

The app now auto-detects Supabase configuration.

- Without `.env.local`: localStorage mode.
- With Supabase env vars: `/api/state` loads and saves normalized rows.
- If the Supabase tables are empty on first run, the current local state is uploaded as the initial remote state.

This is still an MVP bridge. The next hardening step is replacing whole-state sync with granular server actions for each workflow.
