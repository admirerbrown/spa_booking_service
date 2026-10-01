-- Read-only lookup so the frontend can resume an in-progress booking after
-- a lost connection or page refresh, without needing a direct `select`
-- grant on bookings (which would let anyone enumerate booking rows).
create or replace function public.get_booking_status(
  p_booking_id uuid,
  p_confirmation_token uuid
) returns table (
  booking_id uuid,
  status public.booking_status,
  held_until timestamptz,
  start_time timestamptz,
  end_time timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and confirmation_token = p_confirmation_token;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001'; end if;

  return query
  select v_booking.id, v_booking.status, v_booking.held_until, v_booking.start_time, v_booking.end_time;
end;
$$;

revoke all on function public.get_booking_status(uuid, uuid) from public;
grant execute on function public.get_booking_status(uuid, uuid) to anon, authenticated;
