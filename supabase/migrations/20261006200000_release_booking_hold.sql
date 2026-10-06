alter table public.bookings
  drop constraint if exists bookings_status_shape_check;

alter table public.bookings
  add constraint bookings_status_shape_check check (
    (status = 'held' and held_until is not null and customer_name is null and customer_contact is null)
    or (status = 'confirmed' and held_until is null and customer_name is not null and customer_contact is not null)
    or (status = 'cancelled' and held_until is null and (
      (customer_name is null and customer_contact is null)
      or (customer_name is not null and customer_contact is not null)
    ))
  );

create or replace function public.release_booking_hold(
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
  where id = p_booking_id and confirmation_token = p_confirmation_token
  for update;

  if not found or v_booking.status <> 'held' then
    raise exception 'HOLD_NOT_FOUND' using errcode = 'P0001';
  end if;

  return query
  update public.bookings as b
  set status = 'cancelled', held_until = null
  where b.id = v_booking.id
  returning b.id, b.status;
end;
$$;

revoke all on function public.release_booking_hold(uuid, uuid) from public;
grant execute on function public.release_booking_hold(uuid, uuid) to anon, authenticated;
