# StoneOS TODO

## Completed 2026-07-13 - Code-Side Shipping Gates

- Added `/health`, `/health/live` and `/health/ready`; readiness verifies PostgreSQL without exposing connection details.
- Added defensive API headers, removed the Express signature, trusted one proxy hop and added configurable per-instance rate limiting.
- Added CI gates for clean Prisma migrations, isolated PostgreSQL tests, backend/frontend builds, frontend route/type checks and production Docker image builds; the manual deploy repeats them before ECR publishing.
- Added explicit policy/denial coverage for every restricted mutation.
- Added DTO tests for unknown root/nested fields and invalid critical payloads.
- Enforced positive database ledger quantities and unit quantity for item-level adjustments.
- Added append-only reversal, on-hand agreement and double-removal/negative-stock tests.

Validation:

- Fresh isolated schema reset applied all three migrations.
- Backend build passed.
- Backend suite passed: 12 suites, 122 tests.
- Frontend route policy passed: 5 tests.
- Frontend TypeScript and production build passed.
- `/health` returned 200 with PostgreSQL reachable and defensive headers.
- Docker image execution remains an environment gate because Docker is not installed on this workstation; CI now builds both images.

## Completed 2026-07-13 - Cross-Tenant Reference Authorization

- Added PostgreSQL-backed tenant-isolation tests for supplier, location, raw block, slab, machine, production session, customer, sales order, invoice, vehicle and expense-allocation references.
- Goods receipts now reject foreign-factory locations before a draft receipt is created.
- Opening slabs now verify their inventory location belongs to the caller's factory.
- Vehicle expenses now verify the selected vehicle belongs to the caller's factory.
- Expense allocations now verify every referenced raw block belongs to the caller's factory.

Validation:

- Backend build passed.
- Complete database-backed backend suite passed: 9 suites, 36 tests.

## Completed 2026-07-13 - Four-Role Authorization Audit Fixes

- Operator UI no longer shows cutting/polishing abort actions that its backend role cannot execute.
- Manager notes moved to an owner/manager-only DPR endpoint; general production input rejects the management department.
- Managers can no longer demote an existing owner through reprovisioning.
- Added production route policy guarding and fail-closed dashboard module visibility.
- Restricted sales-order, daily-sales summary and sale-eligible slab reads to commercial/inventory/audit roles; operators are excluded.
- Historical sales imports now require and store import reason, actor and timestamp.
- Corrected Team Access copy to owner/manager.
- Added credential-free route-policy, controller-policy, service and database workflow tests.

Validation:

- Frontend route policy: 5 tests passed using Node's built-in test runner without Clerk.
- Frontend TypeScript check passed.
- Frontend production build passed.
- Backend build passed.
- Full database-backed backend suite passed: 8 suites, 27 tests.
- Real Clerk browser sessions passed for Operator, Supervisor, Manager and Owner.
- Owner and Manager can administer users; Manager cannot grant Owner. Supervisor and Operator are rejected from admin/setup routes.
- Operator can use cutting/polishing but cannot reach sales/admin, see abort controls, or see inaccessible commercial/AI dashboard actions.

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

Last updated: 2026-07-13

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

## Completed 2026-07-16 - Operational Follow-through

- Added partial-output cutting resolution with supervisor/manager authorization.
- Added append-only cutting day-log correction revisions with required reasons.
- Added damaged-slab cost allocation against raw-block cost.
- Added mixed-size slab dimensions for cutting completion.
- Added customer-return inventory workflow with idempotent return movements.
- Added recovery reporting against the 105 sqft/ton benchmark.
- Added item-level Tally inventory-entry parsing and persistence.
- Added focused tests for cutting, sales returns/recovery and Tally inventory details.

Validation:

- Prisma schema validation passed with the configured test URL.
- Database-independent backend suite passed: 16 suites, 124 tests.
- Backend and frontend production builds passed.
- `npm audit --omit=dev` reported zero vulnerabilities.
- PR #3 merged after all CI, CodeQL, Trivy/SBOM and production-image checks passed.

## P0 - Product Safety Before Real Deployment

- Rotate the exposed development Clerk secret and configure production Clerk credentials/domains.
- Provision production infrastructure, rehearse migrations, verify backups/restores and run the production-container four-role smoke test.

## P1 - Required PRD Test Coverage

- Keep CI policy and DTO matrices updated whenever a mutating endpoint is added; current endpoint changes include focused coverage.

## Completed 2026-07-12 - PostgreSQL Workflow and Concurrency Verification

- Restored PostgreSQL 16.14 as an isolated portable local runtime bound only to `127.0.0.1:5432`.
- Created the disposable `stoneos` database and loaded Prisma into the approved `legacy_migration_test_clean` schema.
- Extended the database smoke suite with simultaneous cutting, polishing and sales reservation races.
- Verified exactly one winner and one active reservation for each concurrent race.
- Full workflow smoke passed: opening stock, goods receipt, cutting, polishing, sales reservation, delivery, invoice, payment, abort and cancellation.
- Complete backend suite passed: 6 suites, 23 tests.

## P2 - Product and Documentation Polish

- Keep AI OS personalization as local UI preference data until an AI/backend PRD defines durable records and audit expectations.

## Data Entry Reasoning

- Operational data entry belongs in StoneOS only when it represents a real factory/accounting event: opening count, goods receipt, production, polishing, sales reservation, delivery, invoice, payment, expense, vehicle, customer, machine, user access or controlled historical import.
- Historical backfill is valid only as migration/import data and must not alter live inventory.
- UI personalization is valid as local preference only; it is not factory truth.
