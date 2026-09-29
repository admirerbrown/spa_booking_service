create extension if not exists pgcrypto;

create type public.booking_status as enum ('held', 'confirmed');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  price numeric(10, 2) not null check (price >= 0),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.therapists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  bio text not null default '',
  timezone text not null default 'Africa/Accra',
  created_at timestamptz not null default now()
);

create table public.therapist_working_hours (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at),
  unique (therapist_id, weekday, starts_at, ends_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  therapist_id uuid not null references public.therapists(id),
  customer_name text,
  customer_contact text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status public.booking_status not null,
  held_until timestamptz,
  confirmation_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (start_time < end_time),
  check ((status = 'held' and held_until is not null and customer_name is null and customer_contact is null)
      or (status = 'confirmed' and held_until is null and customer_name is not null and customer_contact is not null))
);

create index bookings_active_lookup on public.bookings (therapist_id, start_time, end_time);

alter table public.services enable row level security;
alter table public.therapists enable row level security;
alter table public.therapist_working_hours enable row level security;
alter table public.bookings enable row level security;

create policy "public can read services" on public.services for select using (true);
create policy "public can read therapists" on public.therapists for select using (true);
create policy "public can read working hours" on public.therapist_working_hours for select using (true);

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

create or replace function public.create_booking_hold(
  p_service_id uuid,
  p_therapist_id uuid,
  p_start_time timestamptz
) returns table (booking_id uuid, confirmation_token uuid, held_until timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_end_time timestamptz;
  v_duration integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_therapist_id::text, 0));
  select duration_minutes into v_duration from public.services where id = p_service_id;
  if v_duration is null then raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0001'; end if;
  v_end_time := p_start_time + make_interval(mins => v_duration);
  perform public.assert_bookable_slot(p_therapist_id, p_start_time, v_end_time);

  return query
  insert into public.bookings as b (service_id, therapist_id, start_time, end_time, status, held_until)
  values (p_service_id, p_therapist_id, p_start_time, v_end_time, 'held', clock_timestamp() + interval '5 minutes')
  returning b.id, b.confirmation_token, b.held_until;
end;
$$;

create or replace function public.confirm_booking_hold(
  p_booking_id uuid,
  p_confirmation_token uuid,
  p_customer_name text,
  p_customer_contact text
) returns table (booking_id uuid, start_time timestamptz, end_time timestamptz, status public.booking_status)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and confirmation_token = p_confirmation_token for update;
  if not found or v_booking.status <> 'held' then raise exception 'HOLD_NOT_FOUND' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_booking.therapist_id::text, 0));
  if v_booking.held_until <= clock_timestamp() then raise exception 'HOLD_EXPIRED' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_customer_name, ''))) = 0 or char_length(trim(coalesce(p_customer_contact, ''))) = 0 then
    raise exception 'CUSTOMER_DETAILS_REQUIRED' using errcode = 'P0001';
  end if;
  perform public.assert_bookable_slot(v_booking.therapist_id, v_booking.start_time, v_booking.end_time, v_booking.id);

  return query update public.bookings as b
  set status = 'confirmed', held_until = null, customer_name = trim(p_customer_name), customer_contact = trim(p_customer_contact), confirmed_at = clock_timestamp()
  where id = v_booking.id
  returning b.id, b.start_time, b.end_time, b.status;
end;
$$;

create or replace function public.get_active_booking_intervals(
  p_therapist_id uuid,
  p_from timestamptz,
  p_until timestamptz
) returns table (start_time timestamptz, end_time timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select b.start_time, b.end_time
  from public.bookings b
  where b.therapist_id = p_therapist_id
    and (b.status = 'confirmed' or (b.status = 'held' and b.held_until > clock_timestamp()))
    and tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_from, p_until, '[)');
$$;

revoke all on public.bookings from anon, authenticated;
revoke all on function public.assert_bookable_slot(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.create_booking_hold(uuid, uuid, timestamptz) from public;
revoke all on function public.confirm_booking_hold(uuid, uuid, text, text) from public;
revoke all on function public.get_active_booking_intervals(uuid, timestamptz, timestamptz) from public;
grant select on public.services, public.therapists, public.therapist_working_hours to anon, authenticated;
grant execute on function public.create_booking_hold(uuid, uuid, timestamptz) to anon, authenticated;
grant execute on function public.confirm_booking_hold(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.get_active_booking_intervals(uuid, timestamptz, timestamptz) to anon, authenticated;
