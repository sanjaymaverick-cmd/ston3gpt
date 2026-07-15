---
name: stoneos
description: Work safely in the StoneOS npm monorepo, including its NestJS and Prisma backend, Next.js frontend, PostgreSQL tests, Docker images, and release checks.
---

# StoneOS development workflow

## Architecture

- The repository is an npm-workspaces monorepo.
- `packages/backend` is a NestJS API using Prisma and PostgreSQL.
- `packages/frontend` is a Next.js App Router application using Clerk.
- Production images are defined by the package-level Dockerfiles and exercised by `docker-compose.prod.yml`.

## Repository conventions

- Follow the existing file names. Backend domain files commonly use kebab-case suffixes such as `*.service.ts`, `*.controller.ts`, and `*.guard.ts`.
- Use relative imports within a package and shared modules under the package's existing `common`, `components`, or `lib` directories.
- Backend Jest tests use `*.spec.ts`. Frontend route-policy tests use Node's test runner and `*.test.ts`.
- Keep administrative backfill workflows separate from normal operational screens.
- Preserve tenant boundaries, role checks, and append-only inventory-ledger behavior.

## Validation

Run the narrowest relevant checks first, then the release gates for cross-cutting changes:

```text
npm ci
npx prisma validate --schema packages/backend/prisma/schema.prisma
npx prisma generate --schema packages/backend/prisma/schema.prisma
npm test --workspace=packages/backend
node --test packages/frontend/lib/routePolicy.test.ts
npx tsc --noEmit -p packages/frontend/tsconfig.json
npm run build --workspace=packages/backend
npm run build --workspace=packages/frontend
npm audit --omit=dev
docker compose -f docker-compose.prod.yml config --quiet
```

Database integration tests must use an isolated schema such as `legacy_migration_test`. Never enable destructive workflow-test truncation against the local development or production schema.

## Security and release safety

- Never commit Clerk keys, database credentials, or deployment credentials.
- Treat `NEXT_PUBLIC_*` values as build-time frontend configuration even when they are not confidential.
- Use package lockfiles and `npm ci` in CI and Docker builds.
- Keep production dependency audits at zero known vulnerabilities.
- Verify both `/health/live` and database-backed readiness behavior when changing the backend runtime.
- Inspect staged scope before committing and exclude generated build artifacts such as `tsconfig.tsbuildinfo`.
