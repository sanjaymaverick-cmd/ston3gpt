# StoneOS Production Readiness Status

Updated: 2026-09-02 (Asia/Calcutta)
Branch baseline: `codex/complete-app-todo` at `d90c5959cf6724fca05fb0860cf2c758d750cb63`

## Resolved production blockers

### High — financial idempotency and balance integrity

- Invoice creation now locks the tenant-scoped sales order in a serializable transaction. An identical retry returns the existing invoice; a conflicting second invoice is rejected. No orphan invoice is committed.
- Payment creation requires a stable idempotency key. The service returns an identical retry, rejects key reuse with different data, locks the tenant-scoped invoice, and rejects cumulative payment above the invoice amount.
- Database uniqueness on `(factory_id, idempotency_key)` makes payment retries race-safe. Historical payments remain compatible because the new key is nullable only at the schema/storage layer; the API DTO requires it for new writes.
- Frontend payment keys persist across network retries and rotate only after a successful request.

### High — expense allocation integrity

- Allocation now locks the tenant-scoped expense in a serializable transaction and includes existing allocations in the limit check.
- Allocation requests require a stable batch key. Identical retries return the original rows; conflicting key reuse and duplicate raw-block lines are rejected.
- Database uniqueness on `(expense_id, allocation_batch_key, raw_block_id)` prevents concurrent duplicate posting. Positive-amount database constraints backstop DTO validation.
- Frontend allocation keys persist across network retries and rotate only after success.

### High — supply-chain findings

No Trivy suppression or exception was added. The packages reported by scheduled run `33379869516` were upgraded to fixed versions:

| Package | Secured version |
|---|---:|
| Next.js | 16.3.4 |
| sharp/libvips | 0.35.4 |
| fast-xml-parser | 5.11.1 |
| fast-uri | 3.1.5 |
| nanoid | 3.3.18 |
| browserslist | 4.28.8 |
| PostCSS | 8.5.26 |

The root, backend-Docker, and frontend-Docker lockfiles each report `found 0 vulnerabilities` for the full `npm audit`, including development tooling. A local Trivy rescan is blocked because the Trivy binary is not installed; the GitHub alert state will remain open until CI scans the pushed commit.

### High — damaged-slab valuation

When both values exist, damage cost now uses the actual raw-block amount paid and falls back to invoiced amount only when actual payment is absent. A conflicting-values regression verifies the basis.

### Deployment target cleanup

AWS is no longer a deployment target. `AWS-DEPLOYMENT.md` and the AWS/ECR workflow were removed, and README/TODO references were corrected. Platform-neutral Docker build and health gates remain.

## Migration

Migration: `packages/backend/prisma/migrations/20260902090000_financial_idempotency_and_limits/migration.sql`

It adds nullable storage columns for compatibility with historical rows, unique indexes for new idempotency keys, and positive amount constraints. The application requires keys on all new API writes. Rollback is not lossless after new keyed writes: dropping the columns removes retry identity, and rolling application code back would re-enable duplicate/excess posting.

### Production-like rehearsal procedure

1. Stop writes to the sanitized rehearsal source and take a database-native backup. Record its checksum and PostgreSQL version.
2. Restore into a disposable PostgreSQL 16 database with access restricted to the rehearsal team. Never point rehearsal commands at production.
3. Before migration, run and retain results for:
   - `SELECT id FROM payment WHERE amount <= 0;`
   - `SELECT id FROM expense_allocation WHERE allocated_amount <= 0;`
   - `SELECT e.id, e.amount, COALESCE(SUM(a.allocated_amount), 0) allocated FROM expense e LEFT JOIN expense_allocation a ON a.expense_id=e.id GROUP BY e.id HAVING COALESCE(SUM(a.allocated_amount), 0) > e.amount;`
   - sales orders linked to missing or multiple logical invoice records, based on invoice number/customer/order audit records.
4. Point a dedicated `DATABASE_URL` at the restored database and run `npx prisma migrate deploy --schema packages/backend/prisma/schema.prisma`.
5. Run `npx prisma migrate status`, Prisma validation/generation, the complete backend suite, and the financial concurrency tests.
6. Verify legacy payment/allocation rows remain readable; create and retry one invoice, one payment, and one multi-line allocation; confirm row counts do not increase on retry.
7. Run the cumulative allocation and concurrent overpayment cases and confirm exactly one permissible write commits.
8. Exercise receipt → cutting → finishing → reservation → dispatch → invoice/payment plus expense and Tally workflows against rehearsal data.
9. Restore the original backup into a second disposable database and compare critical table counts/totals. This proves backup restorability; SQL down-migration alone is not an acceptable rollback.
10. Record durations, query results, test output, image digests, approver, and go/no-go decision. On production deployment, take a fresh backup and use the same artifact versions. If migration fails, stop and restore; do not mark a failed migration resolved manually without review.

## Verification evidence

- Focused financial/damage regressions: **3 suites, 17 tests passed**.
- Complete backend attempt: **20 suites total; 18 suites / 131 tests passed**. The two PostgreSQL-backed suites (21 tests) could not connect to `127.0.0.1:5432`; source/unit failures were zero.
- Frontend route policy: **5/5 passed**.
- Frontend TypeScript: passed.
- Prisma format: passed; schema validation passed with the isolated CI URL configured; client generation passed.
- Backend production build: passed.
- Frontend production build on secured Next.js 16.3.4: passed; 16 static routes generated.
- Full dependency audit: root, backend lock, and frontend lock each passed with zero vulnerabilities.
- Docker image builds: blocked locally because the Docker Desktop Linux engine is not running.
- Local Trivy filesystem scan: blocked because `trivy` is not installed.
- Migration deploy/rehearsal and PostgreSQL concurrency tests: blocked because no PostgreSQL server is listening locally.
- Lint: repository has no lint script; type checking and builds are the available static gates.

## Remaining production blockers and risks

1. Run the migration rehearsal and all PostgreSQL-backed tests on an isolated PostgreSQL 16 instance.
2. Run Trivy with the repository workflow and confirm all HIGH/CRITICAL alerts close; also review any non-production dev-only audit findings separately.
3. Start Docker and build both Dockerfiles; run backend `/health`, `/health/ready`, and `/health/live`, and smoke the frontend container against the backend.
4. Select the non-AWS hosting target and add an explicit protected release workflow, migration step, backup/restore gate, environment protection, secrets model, observability, and rollback procedure.
5. Complete operator acceptance testing using sanitized representative factory and Tally exports. No production credentials, infrastructure, secrets, or databases were changed during this work.

## Deployment checklist

- [ ] PostgreSQL rehearsal backup restored and checksum verified.
- [ ] Preflight financial-integrity queries reviewed and exceptions resolved.
- [ ] Prisma migrate deploy/status and complete PostgreSQL suites pass.
- [ ] Root/backend/frontend production audits and Trivy HIGH/CRITICAL scan pass.
- [ ] Backend/frontend images build; immutable image digests recorded.
- [ ] Health, readiness, authentication, role, and cross-tenant smoke tests pass in staging.
- [ ] Critical granite workflow and Tally retry/duplicate tests pass with representative data.
- [ ] Backup restore is timed and proven; rollback owner and stop criteria are named.
- [ ] Hosting target, environment protections, secrets, monitoring, and on-call ownership are approved.
- [ ] Deploy during a controlled write window; verify financial totals and inventory counts before reopening writes.

Recommended next action: provide or start an isolated PostgreSQL 16 and Docker engine, run the rehearsal/checklist above, then push only after review so GitHub Trivy/CodeQL can produce authoritative remote evidence.
