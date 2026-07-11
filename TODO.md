# StoneOS TODO

Last updated: 2026-07-11

## P0 - Product Safety Before Real Deployment

- Add backend `RolesGuard` coverage to remaining mutating controllers: expenses, vehicles, customers, DPR, machine runtime logs, daily-sales historical backfill and Tally imports.
- Add tenant checks anywhere a mutation references another record by ID, starting with machine runtime logs.
- Replace inline `@Body()` object types with validated DTO classes for vehicles, customers and admin user provisioning.
- Fix inventory adjustment and movement reversal so ledger entries and item snapshot state update atomically, duplicate reversals are rejected and negative stock is impossible.
- Move historical daily-sales backfill out of the regular Sales screen into admin/import-only workflow with explicit reason/audit context.

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
