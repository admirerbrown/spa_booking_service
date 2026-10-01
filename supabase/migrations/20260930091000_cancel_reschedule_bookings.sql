-- Replace the status-shape check to allow 'cancelled' rows (which keep the
-- customer details from when they were confirmed, but have no held_until).
do $$
declare
  v_conname text;
begin
  for v_conname in
    select conname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%held_until%'
  loop
    execute format('alter table public.bookings drop constraint %I', v_conname);
  end loop;
end $$;

-- Hard fallback: Postgres's conventional auto-generated name for the second
-- unnamed check constraint on this table, confirmed from the actual error
-- message. Harmless no-op if the loop above already dropped it.
alter table public.bookings drop constraint if exists bookings_check1;

alter table public.bookings add constraint bookings_status_shape_check check (
  (status = 'held' and held_until is not null and customer_name is null and customer_contact is null)
  or (status = 'confirmed' and held_until is null and customer_name is not null and customer_contact is not null)
  or (status = 'cancelled' and customer_name is not null and customer_contact is not null)
);

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_confirmation_token uuid
) returns table (booking_id uuid, status public.booking_status)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and confirmation_token = p_confirmation_token for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_booking.status <> 'confirmed' then raise exception 'BOOKING_NOT_CANCELLABLE' using errcode = 'P0001'; end if;
  if v_booking.start_time - interval '1 hour' <= clock_timestamp() then
    raise exception 'CANCELLATION_WINDOW_CLOSED' using errcode = 'P0001';
  end if;

  return query update public.bookings as b
  set status = 'cancelled'
  where id = v_booking.id
  returning b.id, b.status;
end;
$$;

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_confirmation_token uuid,
  p_new_start_time timestamptz
) returns table (booking_id uuid, start_time timestamptz, end_time timestamptz, status public.booking_status)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings%rowtype;
  v_duration integer;
  v_new_end_time timestamptz;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and confirmation_token = p_confirmation_token for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_booking.status <> 'confirmed' then raise exception 'BOOKING_NOT_CANCELLABLE' using errcode = 'P0001'; end if;
  -- Cutoff is checked against the *original* start time, protecting the
  -- therapist's existing schedule from last-minute changes.
  if v_booking.start_time - interval '1 hour' <= clock_timestamp() then
    raise exception 'CANCELLATION_WINDOW_CLOSED' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_booking.therapist_id::text, 0));
  select duration_minutes into v_duration from public.services where id = v_booking.service_id;
  v_new_end_time := p_new_start_time + make_interval(mins => v_duration);
  -- Excludes this booking's own row from the conflict check, and reuses the
  -- same working-hours + overlap validation as a fresh booking.
  perform public.assert_bookable_slot(v_booking.therapist_id, p_new_start_time, v_new_end_time, v_booking.id);

  return query update public.bookings as b
  set start_time = p_new_start_time, end_time = v_new_end_time
  where id = v_booking.id
  returning b.id, b.start_time, b.end_time, b.status;
end;
$$;

revoke all on function public.cancel_booking(uuid, uuid) from public;
revoke all on function public.reschedule_booking(uuid, uuid, timestamptz) from public;
grant execute on function public.cancel_booking(uuid, uuid) to anon, authenticated;
grant execute on function public.reschedule_booking(uuid, uuid, timestamptz) to anon, authenticated;
