-- Search (T-4.1, F-C1, lld.md §1): "Palwal → Shankar Chowk, tomorrow 8–9".
--
-- A ride matches when it has a stop within 2 km of the rider's pickup and a later stop within
-- 2 km of their drop (the later stop is what keeps cars going the other way out), the car
-- reaches that pickup stop inside the rider's time window, and it still has the seats they
-- need. Riders never see their own rides, rides from someone either of them has blocked
-- (F-F8), or women-only rides unless they're a woman (F-F10).

-- ---------------------------------------------------------------------------------------------
-- The matcher, for search here and for cross-car matching later (T-5.4, lld.md §5). For each
-- ride it picks the pickup and drop stops with the least walking. Internal: only other
-- functions call it.

create function private.match_rides(
  p_rider_id uuid,
  p_from extensions.geography,
  p_to extensions.geography,
  p_pickup_after timestamptz,          -- the car must reach the pickup stop in this window
  p_pickup_before timestamptz,
  p_seats smallint default 1
)
returns table (
  ride_id uuid,
  pickup_seq smallint,
  pickup_label text,
  pickup_at timestamptz,
  pickup_walk_m integer,
  drop_seq smallint,
  drop_label text,
  drop_at timestamptz,
  drop_walk_m integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.id)
         r.id,
         p.seq,
         p.label,
         r.depart_at + make_interval(mins => p.eta_offset_min),
         round(extensions.st_distance(p.geo, p_from))::integer,
         d.seq,
         d.label,
         r.depart_at + make_interval(mins => d.eta_offset_min),
         round(extensions.st_distance(d.geo, p_to))::integer
    from public.rides r
    join public.ride_stops p on p.ride_id = r.id
    join public.ride_stops d on d.ride_id = r.id and d.seq > p.seq
   where r.status in ('OPEN', 'ALLOCATING')      -- still taking requests
     and r.seats_left >= p_seats
     and r.depart_at > now()
     and r.owner_id <> p_rider_id
     and extensions.st_dwithin(p.geo, p_from, 2000)
     and extensions.st_dwithin(d.geo, p_to, 2000)
     and r.depart_at + make_interval(mins => p.eta_offset_min)
         between p_pickup_after and p_pickup_before
     and (
       not r.women_only
       or exists (select 1 from public.users u where u.id = p_rider_id and u.gender = 'female')
     )
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_rider_id and b.blocked_id = r.owner_id)
           or (b.blocker_id = r.owner_id and b.blocked_id = p_rider_id)
     )
   order by r.id, extensions.st_distance(p.geo, p_from) + extensions.st_distance(d.geo, p_to)
$$;

revoke execute on function private.match_rides(
  uuid, extensions.geography, extensions.geography, timestamptz, timestamptz, smallint
) from public;

-- ---------------------------------------------------------------------------------------------
-- What the search screen calls, as the signed-in rider. Best fit first: the fewest metres of
-- walking plus 50 for every minute the car comes after the start of the window, so a car 20
-- minutes later is worth about 1 km less walking.

create function public.search_rides(
  p_from_lat double precision,
  p_from_lng double precision,
  p_to_lat double precision,
  p_to_lng double precision,
  p_date date,                           -- in India
  p_time_from time default '00:00',      -- when the car reaches the pickup stop, in India
  p_time_to time default '23:59:59',
  p_seats smallint default 1
)
returns table (
  ride_id uuid,
  depart_at timestamptz,
  allocation_at timestamptz,
  status public.ride_status,
  seats_left smallint,
  seats_total smallint,
  price_per_seat integer,
  women_only boolean,
  notes text,
  owner_first_name text,
  owner_photo_url text,
  car_model text,
  car_colour text,
  start_label text,
  end_label text,
  pickup_seq smallint,
  pickup_label text,
  pickup_at timestamptz,
  pickup_walk_m integer,
  drop_seq smallint,
  drop_label text,
  drop_at timestamptz,
  drop_walk_m integer,
  my_booking_status public.booking_status   -- set when the rider already has a request in
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
  v_after timestamptz := (p_date + p_time_from) at time zone 'Asia/Kolkata';
  v_before timestamptz := (p_date + p_time_to) at time zone 'Asia/Kolkata';
begin
  if v_rider is null then
    raise exception 'Sign in to search' using errcode = '42501';
  end if;
  if p_from_lat not between -90 and 90 or p_to_lat not between -90 and 90
     or p_from_lng not between -180 and 180 or p_to_lng not between -180 and 180 then
    raise exception 'Not a place on the map' using errcode = '22023';
  end if;
  if p_time_to < p_time_from then
    raise exception 'The time window ends before it starts' using errcode = '22023';
  end if;
  if p_seats not between 1 and 7 then
    raise exception 'Between 1 and 7 seats' using errcode = '22023';
  end if;

  return query
  select r.id, r.depart_at, r.allocation_at, r.status, r.seats_left, r.seats_total,
         r.price_per_seat, r.women_only, r.notes,
         split_part(u.name, ' ', 1), u.photo_url, c.model, c.colour,
         (select s.label from public.ride_stops s where s.ride_id = r.id order by s.seq limit 1),
         (select s.label from public.ride_stops s where s.ride_id = r.id
           order by s.seq desc limit 1),
         m.pickup_seq, m.pickup_label, m.pickup_at, m.pickup_walk_m,
         m.drop_seq, m.drop_label, m.drop_at, m.drop_walk_m,
         (select b.status from public.bookings b
           where b.ride_id = r.id and b.rider_id = v_rider
             and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED'))
    from private.match_rides(
           v_rider,
           extensions.st_setsrid(extensions.st_makepoint(p_from_lng, p_from_lat), 4326)
             ::extensions.geography,
           extensions.st_setsrid(extensions.st_makepoint(p_to_lng, p_to_lat), 4326)
             ::extensions.geography,
           v_after, v_before, p_seats
         ) m
    join public.rides r on r.id = m.ride_id
    join public.users u on u.id = r.owner_id
    join public.cars c on c.id = r.car_id
   order by m.pickup_walk_m + m.drop_walk_m
              + 50 * extract(epoch from m.pickup_at - v_after) / 60,
            m.pickup_at, r.id;
end
$$;

revoke execute on function public.search_rides(
  double precision, double precision, double precision, double precision, date, time, time,
  smallint
) from public, anon;
grant execute on function public.search_rides(
  double precision, double precision, double precision, double precision, date, time, time,
  smallint
) to authenticated;
