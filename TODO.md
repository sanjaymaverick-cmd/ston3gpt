# StoneOS TODO

## Completed 2026-07-12 - Workflow Simplification

- Removed the duplicate manual department DPR entry surface; the Production page now derives its daily summary from cutting-session day logs.
- Split Sales into focused `Orders & Reservations`, `Dispatch`, and `Billing` views.
- Removed sales-line GST/loading/transport/payment fields that the order API did not persist; invoice and payment data now stay in the Billing workflow.
- Added invoice selection for payments instead of requiring pasted internal invoice IDs.
- Converted opening inventory into a five-step guided count: start, raw blocks, unpolished slabs, finished slabs, review.
- Opening approval now makes the factory live in the same transaction; the separate visible go-live action was removed.
- Simplified receiving to a single `Receive Blocks` action while retaining create/submit separation inside the API.
- Moved inventory corrections behind manager/owner role checks and replaced technical location/status labels with operational language.
- Added role-focused navigation and a role-aware `My Work` dashboard.
- Added approval-to-live test coverage.

Validation:

- Frontend TypeScript check passed.
- Backend build passed.
- Focused backend role, tenant and inventory suite passed: 4 suites, 14 tests.
- `/dashboard`, `/dpr`, `/polishing`, `/sales`, `/inventory`, `/receipts/raw-blocks`, and `/setup/opening-inventory` returned HTTP 200 locally.

## Completed 2026-07-12 - Workflow Simplification Follow-through

- Added a derived operations endpoint combining cutting logs, completed polishing runs, machine utilization, dispatch counts and manager notes.
- Prevented runtime, downtime and power double-counting when both session records and machine logs exist.
- Added selective slab dispatch so a reservation can be dispatched partially while remaining slabs stay reserved.
- Added shared human-readable workflow and location labels across Inventory, Production, Polishing, Sales and Dashboard views.
- Added structured manager-only inventory exception categories plus optional evidence notes.
- Collapsed setup, machines, Tally, historical data and team access into an expandable Admin navigation group.
- Added derived-DPR unit coverage.

Validation:

- Frontend TypeScript check passed.
- Backend build passed.
- Focused no-database test suite passed: 5 suites, 15 tests.
- Seven principal frontend routes returned HTTP 200.
- PostgreSQL workflow/concurrency smoke remains environment-blocked because `localhost:5432` is not accepting connections.

Last updated: 2026-07-12

## Completed 2026-07-12 - Role Policy First Pass

- Added shared backend role policy constants matching the operating rule:
  - operator: production/machine input only
  - supervisor: operational data entry/approval, but no user/role management and no historical imports
  - manager: user management, historical imports and lower-level data control
  - owner: supreme authority
- Added `RolesGuard` coverage to mutating expenses, vehicles, customers, DPR, machine runtime logs, daily-sales backfill and Tally import controllers.
- Restricted historical daily-sales backfill and Tally imports to owner/manager.
- Restricted user provisioning to owner/manager; only owner can grant the owner role.
- Added DTO classes for user provisioning, vehicles and customers.
- Added tenant check for machine runtime logs so `machineId` must belong to the caller's factory.
- Added focused no-database role-policy unit tests.

Validation:

- `npm.cmd run build --workspace=packages/backend`: passed.
- `jest role-policy --runInBand`: passed.
- Full backend smoke test could not run because local Postgres at `localhost:5432` was unreachable during this session.

## Completed 2026-07-12 - Role/Tenant Tests, Inventory Reversal Semantics, Historical Sales UI Move

- Added negative role/endpoint metadata tests in `packages/backend/src/common/role-access.spec.ts`.
- Added tenant-check tests for machine runtime logs in `packages/backend/src/modules/production/machine-log.service.spec.ts`.
- Added inventory adjustment/reversal tests in `packages/backend/src/modules/inventory/inventory-workflow.service.spec.ts`.
- Updated inventory adjustment/reversal behavior:
  - manual adjustment must reference exactly one raw block or slab
  - manual adjustment must include a source or destination location
  - source-location moves are rejected when the item is not currently in that location
  - ledger movement and item snapshot update happen in one transaction
  - duplicate reversal idempotency keys are rejected
  - a movement cannot be reversed twice
- Removed historical daily-sales backfill from the regular Sales page.
- Added manager/owner historical sales import page at `packages/frontend/app/admin/historical-sales/page.tsx`.
- Updated navigation so owner/manager see admin history/team links.
- Updated Team Access UI so owner/manager can administer users and managers cannot grant the owner role.

Validation:

- `npm.cmd run build --workspace=packages/backend`: passed.
- `jest role-policy role-access machine-log.service inventory-workflow.service --runInBand`: passed, 13 tests.
- `npm.cmd run build --workspace=packages/frontend`: passed.
- Full backend smoke test with `DATABASE_URL=...legacy_migration_test_clean`: failed only because local Postgres at `localhost:5432` was unreachable; no smoke assertions ran.

## P0 - Product Safety Before Real Deployment

- Add backend `RolesGuard` coverage to any newly added mutating controllers and keep existing role policy consistent with `packages/backend/src/common/role-policy.ts`.
- Add tenant checks anywhere a mutation references another record by ID beyond the completed machine runtime log check.
- Continue replacing any future inline `@Body()` object types with validated DTO classes.
- Add durable reason/audit context storage for historical daily-sales backfill imports.

## P1 - Required PRD Test Coverage

- Add negative role tests for all restricted mutations.
- Add cross-tenant tests for machine, customer, supplier, location, block, slab, session, sales order, invoice and vehicle references.
- Add duplicate reservation and concurrent start/sale/polish tests with the real PostgreSQL test database.
- Add ledger tests for append-only behavior, reversal correctness, on-hand agreement and negative-stock rejection.
- Add controller-level validation tests for DTOs and unknown fields.

## P2 - Product and Documentation Polish

- Keep AI OS personalization as local UI preference data until an AI/backend PRD defines durable records and audit expectations.
- Add cost allocation for damaged slabs against raw block cost.
- Add recovery-ratio reporting using sale-time sqft and the 105 sqft/ton benchmark.
- Add rare mixed-size slab override handling for cutting completion.
- Add item-level Tally import detail when source exports provide sqft per sales line.

## Data Entry Reasoning

- Operational data entry belongs in StoneOS only when it represents a real factory/accounting event: opening count, goods receipt, production, polishing, sales reservation, delivery, invoice, payment, expense, vehicle, customer, machine, user access or controlled historical import.
- Historical backfill is valid only as migration/import data and must not alter live inventory.
- UI personalization is valid as local preference only; it is not factory truth.
