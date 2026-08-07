# Client Change Activity Log Design

## Understanding Summary

- Administrators need a durable record of customer-side meal changes and attempts.
- Each entry must show the trusted server receipt time in Korea Standard Time, including seconds.
- Meal activity must identify the delivery location, delivery date, meal period, before/after quantity, memo, and whether it was before or after cutoff.
- Lunch uses the configured 10:00 cutoff and dinner uses the configured 15:00 cutoff.
- Customer overtime registrations and edits are included but do not receive a meal-cutoff badge.
- The administrator Important Changes screen owns this operational view; administrator actions remain in the existing Settings audit list.
- Existing records are shown from 2026-08-06 when trustworthy source data exists.

## Assumptions

- Supabase remains the production database and `admin_audit_logs` remains append-only operational history.
- Approximately ten delivery locations generate low activity volume, so loading and rendering the retained customer activity rows with existing application state is acceptable.
- Only requests from an authenticated, active contact access group are logged. Rejected authentication attempts are intentionally excluded.
- Missing historical events are not reconstructed from a daily order's final state because that cannot prove who changed it or what the previous value was.

## Chosen Approach

Reuse `admin_audit_logs` with three explicit actions: customer change before cutoff, customer change after cutoff, and customer overtime change. The verified contact server action derives activity entries from the accepted state diff and upserts them with source IDs. Database-generated timestamps are used for new records, preventing a phone clock from controlling the logged time and preventing duplicate rows on retries.

The administrator screen filters these actions, sorts newest first, formats `created_at` in `Asia/Seoul` as `YYYY-MM-DD HH:mm:ss`, and uses a red badge for after-cutoff attempts. Existing administrator audit history is unaffected.

## Alternatives Considered

- **Combine existing order logs, requests, and notifications only in the UI:** fastest, but their timestamps originate in the browser and do not meet the accountability requirement.
- **Create a dedicated activity table:** structurally clean, but adds a migration and deployment dependency without adding needed behavior at the current scale.

## Historical Data Decision

- No customer meal change log, late request, or matching administrator notification exists for the morning of 2026-08-06.
- Two `daily_meal_orders` rows at 09:57:54 KST belong to the administrator's simultaneous creation of the Sumin Frame customer and are not treated as customer changes.
- One trustworthy customer overtime notification exists at 15:50:28 KST for Wonframe, changing overtime dinner from 0 to 19. It can be backfilled into the activity log with its original timestamp.

## Decision Log

1. Record the server receipt time, not the customer device time, because time is evidence for cutoff disputes.
2. Keep all before- and after-cutoff activity, highlighting after-cutoff attempts in red so context is not lost.
3. Reuse the existing audit table to avoid a mandatory schema migration.
4. Deduplicate retries using the originating change/request/notification ID as the audit row ID.
5. Backfill only source records that can be proven; do not infer customer actions from order snapshots.
