-- Search shows the closest cars first: the ones whose stops are nearest to where the rider
-- gets in (A) and where they get out (B), by the total walk to and from the car. Cars just as
-- close come earliest first. Before, every minute later in the day counted as 50 m of walking,
-- so with "any time" picked the list came out in time order and a car stopping at the rider's
-- door could sit below one that left earlier from 2 km away.

create or replace function public.search_rides(
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
   -- Closest first: the least walking from the rider's start to the car's pickup stop and from
   -- its drop stop to where they're going. Equally close cars, earliest first.
   order by m.pickup_walk_m + m.drop_walk_m, m.pickup_at, r.id;
end
$$;
