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

1. Copy `.env.example` to `.env.local` and set the public Supabase values.
2. Apply `supabase/migrations/20260929120000_booking_schema.sql` to your Supabase project.
3. Run `npm install`, then `npm run dev`.

## Tests

`npm test` runs the fast unit and RPC-boundary suite.

`npm run test:db` runs the critical PostgreSQL suite. Start local Supabase first,
apply the migration, then provide `DATABASE_URL`; it uses parallel connections to
prove that exactly one of two overlapping requests succeeds.
