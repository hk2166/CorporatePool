-- Go live (T-3.2, F-B2, D7): turns the owner's usual ride into a ride for one day.
--
-- One transaction copies the template (time, seats, price, notes, stops) into a ride, with
-- optional changes to the time or seats for that day. It never makes two: if the usual ride is
-- already live that day, it returns the existing ride, so a double tap (or the automatic job in
-- T-3.3 running twice) is harmless. Only the server calls it, after checking who's asking.

-- "One ride per usual ride per departure" must ignore cancelled rides: an owner who cancels
-- tomorrow's ride may go live for it again. The table-wide constraint from T-1.2 counted
-- cancelled rides too, so it becomes a partial unique index that skips them.
alter table public.rides drop constraint rides_usual_ride_id_depart_at_key;
create unique index rides_one_live_ride_per_departure_idx
  on public.rides (usual_ride_id, depart_at)
  where status <> 'CANCELLED';

create function public.go_live(
  p_owner_id uuid,
  p_usual_ride_id uuid,
  p_date date,                       -- the day of the ride, in India
  p_depart_time time default null,   -- this day only; defaults to the usual time
  p_seats smallint default null      -- this day only; defaults to the usual seats
)
returns table (ride_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usual public.usual_rides;
  v_car_seats smallint;
  v_seats smallint;
  v_depart timestamptz;
  v_ride_id uuid;
begin
  select * into v_usual
    from public.usual_rides u
   where u.id = p_usual_ride_id and u.owner_id = p_owner_id;
  if not found then
    raise exception 'No such usual ride' using errcode = 'P0002';
  end if;

  -- Riders reach the owner by phone once a seat is confirmed (F-A2).
  if (select u.phone from public.users u where u.id = p_owner_id) is null then
    raise exception 'Add your phone number first' using errcode = 'P0001', hint = 'NO_PHONE';
  end if;

  -- Already live that day (and not cancelled): hand back that ride.
  select r.id into v_ride_id
    from public.rides r
   where r.usual_ride_id = v_usual.id
     and r.status <> 'CANCELLED'
     and (r.depart_at at time zone 'Asia/Kolkata')::date = p_date
   limit 1;
  if v_ride_id is not null then
    return query select v_ride_id, false;
    return;
  end if;

  select c.seats_total into v_car_seats from public.cars c where c.id = v_usual.car_id;
  v_seats := coalesce(p_seats, v_usual.seats_offered);
  if v_seats < 1 or v_seats > v_car_seats then
    raise exception 'Offer between 1 and % seats', v_car_seats
      using errcode = 'P0001', hint = 'BAD_SEATS';
  end if;

  v_depart := (p_date + coalesce(p_depart_time, v_usual.depart_time)) at time zone 'Asia/Kolkata';
  if v_depart <= now() then
    raise exception 'That time has already passed' using errcode = 'P0001', hint = 'IN_PAST';
  end if;

  insert into public.rides (owner_id, car_id, usual_ride_id, depart_at, allocation_at,
                            seats_total, seats_left, price_per_seat, notes)
  values (
    p_owner_id, v_usual.car_id, v_usual.id, v_depart,
    -- Ranked allocation at 22:00 the evening before (Q4, Q6). A ride posted after that time
    -- is first-come from the start, because its allocation time is already past.
    least(((p_date - 1) + time '22:00') at time zone 'Asia/Kolkata', v_depart),
    v_seats, v_seats, v_usual.price_per_seat, v_usual.notes
  )
  returning id into v_ride_id;

  -- The stops, in order. A landmark deleted since the template was saved keeps its name and
  -- location but loses the link to the stop list.
  insert into public.ride_stops (ride_id, seq, place_id, geo, label, eta_offset_min)
  select v_ride_id,
         (e.ord - 1)::smallint,
         (select p.id from public.places p where p.id = (e.stop ->> 'place_id')::uuid),
         extensions.st_setsrid(
           extensions.st_makepoint((e.stop ->> 'lng')::float8, (e.stop ->> 'lat')::float8), 4326
         )::extensions.geography,
         e.stop ->> 'label',
         (e.stop ->> 'eta_offset_min')::smallint
    from jsonb_array_elements(v_usual.stops) with ordinality as e(stop, ord);

  return query select v_ride_id, true;
end
$$;

revoke execute on function public.go_live(uuid, uuid, date, time, smallint)
  from public, anon, authenticated;
grant execute on function public.go_live(uuid, uuid, date, time, smallint) to service_role;
