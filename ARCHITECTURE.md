# Architecture decision record

## Chosen design

The application is a static React/Vite site deployed to GitHub Pages. It uses the
Supabase JavaScript client only for public reads and two PostgreSQL RPCs:
`create_booking_hold` and `confirm_booking_hold`. No separate server is needed.

`services`, `therapists`, and `therapist_working_hours` are normalized public
read models. `bookings` is private: the browser cannot read or write it directly.
The hold RPC returns an opaque, one-time confirmation token; this lets an
anonymous visitor confirm only the hold it created without exposing bookings.

## Integrity model

Each booking RPC takes a transaction-scoped advisory lock derived from the
therapist id. While it holds that lock, it validates the working hours and checks
for overlapping active bookings before changing data. An active booking is either
confirmed, or held with `held_until > now()`. This makes a conflicting concurrent
request wait and then observe the first request's write.

This is intentionally used instead of an exclusion constraint alone. PostgreSQL
constraint predicates cannot safely use the changing value of `now()` to make a
hold stop conflicting at expiry. The RPCs are therefore the sole write route;
they are the database authority for time overlap, expiry, and working hours.

## Time and privacy

All appointment timestamps are stored as `timestamptz` (UTC). Each therapist has
an IANA timezone and normalized local weekly hours; the RPC validates the local
appointment interval. The browser receives only availability data, never another
customer's booking or contact information.

## Test strategy

Pure slot and validation rules have fast Vitest unit tests. PostgreSQL integration
tests use two genuinely parallel RPC calls against a local Supabase database and
cover overlap, future/expired holds, expiry on confirmation, and working hours.
They require `VITE_SUPABASE_URL` and `SUPABASE_ANON_KEY` after `supabase start`.
