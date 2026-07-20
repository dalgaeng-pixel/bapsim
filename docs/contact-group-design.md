# Settlement and Contact Access Group Design

Last updated: 2026-07-20 KST
Status: Implemented in source; Supabase migration and production verification pending

## Understanding Summary

- Hanul Trading is one settlement account, but it has four separate delivery locations: management office, warehouse, print room 1, and print room 3.
- Delivery operations must continue to show and route all four locations separately.
- Monthly settlement and invoice totals must aggregate all four locations under Hanul Trading.
- The management office and warehouse each have an independent customer contact and link.
- One contact manages print room 1 and print room 3 through a single link, while seeing and changing only those two locations.
- The structure must support other customers with multiple delivery locations, separate contacts, and one settlement account.

## Assumptions and Non-Functional Requirements

- Existing delivery-location settings remain independent: address, delivery order, meal defaults, meal type, delivery start date, exception rules, and daily orders.
- A contact link may access one or more explicitly assigned delivery locations. It never grants access to unassigned locations.
- Customer pages do not expose monthly settlement totals, billing account information, or other contacts' information.
- All read and write operations verify membership on the server; hiding a UI item alone is not sufficient authorization.
- The expected scale is tens of delivery locations and contacts, so relational lookups with supporting indexes are sufficient.
- The feature must preserve existing links, PINs, order history, and settlement behavior during migration.
- Documentation and migration notes must remain maintainable by the next developer.

## Decision Log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| Add dedicated settlement accounts | Store a settlement name inside each delivery location | A real relationship prevents grouping mistakes and supports future changes. |
| Add dedicated contact access groups | Keep one link per delivery location, or encode groups in the existing settings payload | Shared contacts need a single secure link with explicit membership. A relational model is safer and easier to maintain. |
| Keep delivery locations as the existing `clients` records | Replace clients with a new hierarchical entity | Existing delivery, defaults, orders, history, and exports are location based. Keeping them avoids unnecessary migration risk. |
| Aggregate monthly settlement by settlement account | Keep one row per delivery location | Hanul Trading receives one invoice, while delivery still needs location-level rows. |
| Restrict customer settlement visibility | Show billing totals in customer pages | The agreed operational requirement is admin-only settlement visibility. |

## Target Data Model

### Existing `clients` table: delivery locations

Add `settlement_account_id`, which is nullable only during migration and required for active locations after migration.

### New `settlement_accounts` table

- `id`
- `name`
- `active`
- timestamps

One settlement account has many delivery locations. Example: `Hanul Trading` contains management office, warehouse, print room 1, and print room 3.

### New `contact_access_groups` table

- `id`
- `name`
- `manager_name`
- `manager_phone`
- `invite_code` (unique)
- `invite_pin`
- `active`
- timestamps

Each group represents one customer-facing login and contains its own link and PIN.

### New `contact_access_group_members` table

- `contact_access_group_id`
- `client_id`
- timestamps
- unique pair constraint

This permits one contact group to manage multiple delivery locations while allowing a location to be reassigned or, if required later, made available to more than one authorized group.

Recommended indexes:

- `clients(settlement_account_id)`
- unique `contact_access_groups(invite_code)`
- `contact_access_group_members(contact_access_group_id)`
- `contact_access_group_members(client_id)`

## Application Behavior

### Admin

- Add settlement-account management for creating, renaming, activating, and assigning delivery locations.
- Add contact-access-group management for issuing a link/PIN and assigning accessible delivery locations.
- A delivery-location form selects one settlement account; its regular operating settings remain in the current form.
- The delivery table remains location based.
- The monthly settlement table groups all calculated and adjusted quantities by settlement account.
- Deleting a settlement account with assigned locations or a contact group with members is blocked. It must be reassigned or deactivated first.

### Customer contact

- The customer route resolves the invite code to a contact access group rather than directly to one delivery location.
- After PIN validation, it loads only that group's assigned locations and their eligible orders.
- A group with one location behaves like today's customer page.
- A group with multiple locations shows each location separately in today, tomorrow, and weekly editing flows. Every change keeps its original `client_id`.
- Print room 1 and print room 3 share one contact link. Management office and warehouse each retain a separate contact link.

## Authorization and Audit Rules

- The server verifies contact-group membership for every customer order read, change request, and information update.
- A supplied `clientId` that is not a group member returns no data and accepts no write.
- Audit entries and notifications include the actual delivery location name and the contact group or manager that acted.
- Deactivating a contact group immediately blocks its link without deleting order history.

## Data Migration

1. Create the new tables, foreign keys, constraints, indexes, and applicable RLS/server access rules.
2. For every existing delivery location, create a one-location settlement account and one-location contact access group using its current invite code and PIN. This preserves current customer links.
3. Attach every existing client to its generated settlement account and contact access group.
4. Create `Hanul Trading` as one settlement account, attach the four current delivery locations, then create or assign three contact groups:
   - management office only
   - warehouse only
   - print room 1 and print room 3 together
5. Switch the customer route and server actions to contact-access-group authorization only after migration verification succeeds.
6. Retire legacy client-level invite code/PIN fields only in a later cleanup migration, after production verification and a rollback window.

## Implementation Record

- Implemented: 2026-07-20 KST.
- Added migration: `docs/supabase-contact-groups-migration.sql`.
- Added admin group management, account-level monthly aggregation and CSV export, group-aware customer routing, multi-location customer selection, and server-side customer mutation membership checks.
- Pending operation: run the migration in the production Supabase SQL Editor, configure Hanul Trading, then verify shared print-room access in production.

## Validation Criteria

- Existing one-location contact links still show only their own location and can submit changes.
- The shared print-room link shows only print room 1 and print room 3 and records changes against the selected room.
- A forged request for management office or warehouse data through the print-room link is denied server-side.
- The delivery table shows all four Hanul Trading locations separately.
- The monthly settlement view shows one Hanul Trading row that sums the four locations, including existing start-date, cutoff, and manual-adjustment rules.
- Type checking, production build, database migration verification, and focused authorization tests pass before release.

## Explicit Non-Goals

- Customer-facing monthly settlement or invoice screens.
- Merging delivery locations into one address, order, or default meal schedule.
- Changing the existing meal scheduling, no-meal rules, or supply-type calculation rules except where aggregation needs them.