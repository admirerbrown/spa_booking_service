insert into public.services (id, name, duration_minutes, price, description)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Restorative Swedish Massage',
    60,
    220.00,
    'A flowing, full-body massage to ease everyday tension and invite deep relaxation.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Deep Tissue Massage',
    60,
    280.00,
    'Focused, firmer pressure works through stubborn tension and tired muscles.'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Aromatic Reset',
    75,
    300.00,
    'A soothing massage paired with aromatic oils for a grounding, restorative pause.'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Warm Stone Ritual',
    90,
    360.00,
    'A slow, warming treatment that combines smooth heated stones with gentle massage.'
  )
on conflict (id) do update
set name = excluded.name,
    duration_minutes = excluded.duration_minutes,
    price = excluded.price,
    description = excluded.description;

insert into public.therapists (id, name, bio, timezone)
values (
  '20000000-0000-4000-8000-000000000001',
  'Sol & Still Treatment Team',
  'A dedicated team offering thoughtful, unhurried care.',
  'Africa/Accra'
)
on conflict (id) do update
set name = excluded.name,
    bio = excluded.bio,
    timezone = excluded.timezone;

insert into public.therapist_working_hours (
  therapist_id,
  weekday,
  starts_at,
  ends_at
)
select
  '20000000-0000-4000-8000-000000000001',
  weekday::smallint,
  '09:00'::time,
  '17:00'::time
from generate_series(0, 6) as weekdays(weekday)
on conflict (therapist_id, weekday, starts_at, ends_at) do nothing;

create or replace function public.assert_bookable_slot(
  p_therapist_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_excluding_booking_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  select timezone into v_timezone from public.therapists where id = p_therapist_id;
  if v_timezone is null then raise exception 'THERAPIST_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE' using errcode = 'P0001'; end if;
  if p_start_time <= clock_timestamp() then raise exception 'PAST_BOOKING_SLOT' using errcode = 'P0001'; end if;

  v_local_start := p_start_time at time zone v_timezone;
  v_local_end := p_end_time at time zone v_timezone;
  if v_local_start::date <> v_local_end::date
     or not exists (
       select 1 from public.therapist_working_hours wh
       where wh.therapist_id = p_therapist_id
         and wh.weekday = extract(dow from v_local_start)::smallint
         and v_local_start::time >= wh.starts_at
         and v_local_end::time <= wh.ends_at
     ) then
    raise exception 'OUTSIDE_WORKING_HOURS' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.bookings b
    where b.therapist_id = p_therapist_id
      and b.id is distinct from p_excluding_booking_id
      and (b.status = 'confirmed' or (b.status = 'held' and b.held_until > clock_timestamp()))
      and tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)')
  ) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;
end;
$$;
