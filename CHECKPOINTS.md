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

## 2026-09-29 — Milestone 2: local Supabase CLI workflow

**Completed**

- Added and pinned the Supabase CLI as a project dev dependency (`2.118.0`).
- Added `supabase/config.toml` and npm commands to start, stop, reset, inspect,
  and integration-test the local stack.
- Updated local setup instructions with the local API, Studio, and test workflow.

**Verification**

- Dependency resolution confirms `supabase@2.118.0` is recorded by npm.

**Environment limitation**

- This hosted workspace returns a native-binary crash when starting the CLI, so
  `supabase start` and `test:db:local` must be run on the developer machine with
  Docker running. The project-local CLI setup itself is committed and reproducible.

**Checkpoint status:** complete (configuration); local-stack execution pending developer machine.

## 2026-09-29 — Milestone 3: local database integration verified

**Completed**

- Ran the local Supabase stack via the Supabase CLI (`supabase start`) with Docker,
  confirming Milestone 2's environment blocker was specific to the earlier hosted
  workspace and not the project setup itself.
- Applied the migration to a fresh local Postgres instance via `supabase db reset`.
- Fixed a test-teardown bug: `afterAll` deleted the test `service` row while
  dependent `bookings` rows still referenced it, violating the foreign key.
  Corrected by deleting bookings before services/therapists in teardown.

**TDD evidence**

- `npm run test:db:local` passed: 1 test file / 5 tests, including the core
  concurrency proof (`allows exactly one of two genuinely parallel, overlapping
  requests`), run against real Postgres via genuinely parallel requests
  (`Promise.allSettled`), not sequential calls.
- Also verified: active vs. expired holds, expired-hold confirmation rejection,
  and working-hours enforcement, all against the live database.

**Checkpoint status:** complete. The concurrency-safe booking constraint (the
project's core differentiator) is now proven end-to-end against real Postgres,
not just asserted in the design.


## 2026-09-30 — Milestone 4: cancellation and rescheduling

**Completed**

- Added `cancelled` status to the booking state machine and updated the
  status-shape check constraint accordingly.
- Added `cancel_booking` and `reschedule_booking` database functions, both
  enforcing a 1-hour-before-start-time cutoff checked against the original
  booking time. Reschedule is atomic: old slot release and new slot booking
  happen in a single transaction, re-using `assert_bookable_slot`'s existing
  exclusion-by-id support so the booking doesn't conflict with its own prior
  slot.
- Fixed two issues found during this cycle: a case-handling gap in the
  migration's dynamic constraint lookup (resolved with an explicit fallback
  drop), and a test-isolation issue where shared time offsets across tests
  could collide (resolved by giving each test a distinct, well-separated
  offset).

**TDD evidence**

- Red: 7 new integration tests written against not-yet-existing functions,
  confirmed failing for the right reason (`function does not exist`).
- Green: `npm run test:db:local` passed: 1 test file / 12 tests, including
  cutoff enforcement (both directions), wrong-token rejection, double-cancel
  rejection, and reschedule atomicity (a rejected reschedule leaves the
  original booking untouched).

**Checkpoint status:** complete. Cancellation and rescheduling are proven
end-to-end against real Postgres, with the same TDD rigor as the core
booking flow.

| Test file                            | What belongs there                        |
| ------------------------------------ | ----------------------------------------- |
| `app.test.tsx`                       | Basic application/UI flow                 |
| `app.booking.test.tsx`               | Booking lifecycle and UI booking behavior |
| `domain/availability.test.ts`        | Pure availability/slot rules              |
| `domain/booking.test.ts`             | Pure booking rules                        |
| `domain/bookingFlow.test.ts`         | Booking state machine/reducer             |
| `lib/availabilityApi.test.ts`        | Availability API behavior                 |
| `lib/bookingApi.test.ts`             | Booking RPC/API behavior with mocks       |
| `lib/bookingApi.integration.test.ts` | Real/integration API behavior             |

