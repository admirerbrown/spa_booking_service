# Therapist Booking System

React/Vite frontend + Supabase/PostgreSQL booking system. The booking database is
the source of truth: overlapping appointments are rejected by transactional
PostgreSQL RPCs, including concurrent requests and temporary holds.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the selected design and rationale.

## Project layout

```text
src/domain/                 Pure booking and availability rules
src/lib/                    Supabase RPC boundary and its tests
supabase/migrations/        Schema, RLS, and integrity RPCs
```

## Local development

1. Run `npm install`. The Supabase CLI is pinned as a project dev dependency;
   use it through npm scripts rather than installing it globally.
2. Start Docker, then run `npm run supabase:start`. The CLI applies migrations
   in `supabase/migrations` automatically and prints the local API URL and anon key.
3. Copy `.env.example` to `.env.local`, replacing `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` with the local values printed by the CLI.
4. Run `npm run dev`. Local Studio is available at `http://127.0.0.1:54323`.

Useful database commands: `npm run supabase:reset`, `npm run supabase:stop`,
and `npm run supabase -- status`.

## Tests

`npm test` runs the fast unit and RPC-boundary suite.

`npm run test:db:local` resets the local database, applies migrations, and runs
the critical PostgreSQL suite. It uses parallel connections to prove that exactly
one of two overlapping requests succeeds. `npm run test:db` remains available
when you need to supply a different `DATABASE_URL`.
