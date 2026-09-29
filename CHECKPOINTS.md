# Delivery checkpoints

This log records completed TDD milestones. Each entry includes the scope,
verification performed, and any remaining dependency so progress is visible
without relying on chat history.

## 2026-09-29 — Milestone 1: project foundation and booking integrity design

**Completed**

- Selected and documented the static React/Vite + Supabase architecture.
- Created the PostgreSQL schema, RLS policies, booking hold/confirmation RPCs,
  working-hours validation, and concurrency-safe per-therapist transaction lock.
- Added the React/Vite starter application and Supabase environment configuration.

**TDD evidence**

- Red: added tests for slot calculation, active/expired holds, customer details,
  and the RPC boundary before their implementation.
- Green: `npm test` passed: 3 test files / 8 tests.
- Refactor/quality: `npm run build` passed and `git diff --check` passed.

**Remaining verification dependency**

- The database integration suite is ready but needs a local Supabase/Postgres
  instance and `DATABASE_URL`. Run `npm run test:db` after applying the migration.

**Checkpoint status:** complete (local application layer); database integration pending environment.
