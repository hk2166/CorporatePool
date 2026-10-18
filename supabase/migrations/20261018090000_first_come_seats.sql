-- Seats go first come, any time, for morning and evening rides alike: a free seat is
-- confirmed the moment someone asks, and a full car puts them on the waiting list. The 22:00
-- ranking by reliability score (20261016101003_allocation.sql) is switched off for now, to come
-- back later.
--
-- What stays:
-- * rides.allocation_at (22:00 the evening before) still marks when cancelling starts to cost
--   points: a rider giving up a confirmed seat after it, or an owner cancelling a ride with
--   riders on it (cancel_booking, cancel_ride). Nothing about that changes.
-- * private.allocate() and the allocate-seats job stay, so the ranking can be switched back on
--   by restoring the two functions below. With no new requests queueing, the job finds nothing
--   to do.
--
-- Changed: request_seat() never queues a request any more, and rematch never queues a rider of
-- a cancelled ride; both place the rider if a seat is free right now.

create or replace function public.request_seat(
  p_rider_id uuid,
  p_ride_id uuid,
  p_pickup_seq smallint,
  p_drop_seq smallint,
  p_seats smallint default 1,
  p_any_car_ok boolean default false
)
returns table (booking_id uuid, status public.booking_status, waitlist_rank integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider public.users;
  v_ride public.rides;
  v_id uuid;
  v_status public.booking_status;
  v_rank integer;
begin
  select * into v_rider from public.users u where u.id = p_rider_id;
  if not found then
    raise exception 'No such rider' using errcode = 'P0002';
  end if;
  -- The owner calls the rider once the seat is confirmed (F-A2).
  if v_rider.phone is null then
    raise exception 'Add your phone number first' using errcode = 'P0001', hint = 'NO_PHONE';
  end if;

  -- Lock the ride: allocation, cancellations and other requests for it wait their turn.
  select * into v_ride from public.rides r where r.id = p_ride_id for update;
  if not found then
    raise exception 'No such ride' using errcode = 'P0002';
  end if;
  if v_ride.owner_id = p_rider_id then
    raise exception 'This is your own ride' using errcode = 'P0001', hint = 'OWN_RIDE';
  end if;
  -- Blocked either way (F-F8) gets the same answer as a closed ride, so nobody can find out
  -- they were blocked.
  if v_ride.status not in ('OPEN', 'ALLOCATING', 'FULL')
     or v_ride.depart_at <= now()
     or exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_rider_id and b.blocked_id = v_ride.owner_id)
           or (b.blocker_id = v_ride.owner_id and b.blocked_id = p_rider_id)
     ) then
    raise exception 'This ride isn''t taking requests' using errcode = 'P0001',
      hint = 'NOT_BOOKABLE';
  end if;
  if v_ride.women_only and v_rider.gender is distinct from 'female' then
    raise exception 'This ride is for women only' using errcode = 'P0001', hint = 'WOMEN_ONLY';
  end if;
  if p_seats is null or p_seats < 1 or p_seats > v_ride.seats_total then
    raise exception 'Ask for between 1 and % seats', v_ride.seats_total
      using errcode = 'P0001', hint = 'BAD_SEATS';
  end if;
  if p_pickup_seq is null or p_drop_seq is null or p_pickup_seq >= p_drop_seq
     or (select count(*) from public.ride_stops s
          where s.ride_id = p_ride_id and s.seq in (p_pickup_seq, p_drop_seq)) <> 2 then
    raise exception 'Pick a pickup stop before your drop stop' using errcode = 'P0001',
      hint = 'BAD_STOPS';
  end if;
  if exists (
    select 1 from public.bookings b
     where b.ride_id = p_ride_id and b.rider_id = p_rider_id
       and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
  ) then
    raise exception 'You''ve already asked for a seat on this ride' using errcode = 'P0001',
      hint = 'ALREADY_REQUESTED';
  end if;
  -- One car at a time: a confirmed seat on a ride within 3 hours of this one rules it out
  -- (lld.md §8).
  if exists (
    select 1
      from public.bookings b
      join public.rides r on r.id = b.ride_id
     where b.rider_id = p_rider_id
       and b.status = 'CONFIRMED'
       and r.status in ('OPEN', 'FULL', 'STARTED')
       and r.depart_at between v_ride.depart_at - interval '3 hours'
                           and v_ride.depart_at + interval '3 hours'
  ) then
    raise exception 'You already have a seat in a car around then' using errcode = 'P0001',
      hint = 'ALREADY_BOOKED';
  end if;

  -- Seats go first come, any time (the 22:00 ranking is switched off for now). Requests that
  -- queued before the switch are decided first, by score, so nobody who asked earlier is
  -- skipped.
  perform private.allocate(p_ride_id);

  if private.take_seats(p_ride_id, p_seats) then
    v_status := 'CONFIRMED';
  else
    v_status := 'WAITLISTED';
    v_rank := private.next_waitlist_rank(p_ride_id);
  end if;

  insert into public.bookings (ride_id, rider_id, pickup_seq, drop_seq, seats, any_car_ok,
                               status, waitlist_rank, decided_at)
  values (p_ride_id, p_rider_id, p_pickup_seq, p_drop_seq, p_seats, p_any_car_ok,
          v_status, v_rank, case when v_status = 'REQUESTED' then null else now() end)
  returning id into v_id;

  if v_status = 'CONFIRMED' then
    perform private.after_confirm(v_id);
  elsif v_status = 'WAITLISTED' then
    insert into public.notifications_outbox (user_id, kind, payload)
    values (p_rider_id, 'booking_waitlisted',
            jsonb_build_object('booking_id', v_id, 'ride_id', p_ride_id, 'rank', v_rank));
  end if;

  return query select v_id, v_status, v_rank;
end
$$;

create or replace function private.rematch(p_booking_id uuid)
returns uuid                                  -- the new booking, or null if nothing fitted
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.bookings;
  v_old_ride public.rides;
  v_pickup public.ride_stops;
  v_drop public.ride_stops;
  v_pickup_at timestamptz;
  v_candidate record;
  v_ride public.rides;
  v_status public.booking_status;
  v_new uuid;
begin
  select b.* into v_old from public.bookings b where b.id = p_booking_id;
  if not found
     or not (
       (v_old.status = 'WAITLISTED' and v_old.any_car_ok)
       or (v_old.status = 'CANCELLED' and v_old.rematch_requested)
     ) then
    return null;
  end if;
  select r.* into v_old_ride from public.rides r where r.id = v_old.ride_id;
  select s.* into v_pickup from public.ride_stops s
   where s.ride_id = v_old.ride_id and s.seq = v_old.pickup_seq;
  select s.* into v_drop from public.ride_stops s
   where s.ride_id = v_old.ride_id and s.seq = v_old.drop_seq;
  v_pickup_at := v_old_ride.depart_at + make_interval(mins => v_pickup.eta_offset_min);

  for v_candidate in
    select m.*
      from private.match_rides(v_old.rider_id, v_pickup.geo, v_drop.geo,
                               v_pickup_at - interval '1 hour', v_pickup_at + interval '1 hour',
                               v_old.seats) m
     where m.ride_id <> v_old.ride_id
       and not exists (
         select 1 from public.bookings b
          where b.ride_id = m.ride_id and b.rider_id = v_old.rider_id
            and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
       )
     order by m.pickup_walk_m + m.drop_walk_m
                + 50 * abs(extract(epoch from m.pickup_at - v_pickup_at)) / 60,
              m.ride_id
  loop
    select r.* into v_ride from public.rides r where r.id = v_candidate.ride_id for update;
    v_status := null;

    -- Seats go first come (the 22:00 ranking is switched off for now): place the rider if one
    -- is free right now.
    perform private.allocate(v_ride.id);
    if private.take_seats(v_ride.id, v_old.seats) then
      v_status := 'CONFIRMED';
    end if;

    if v_status is not null then
      insert into public.bookings (ride_id, rider_id, pickup_seq, drop_seq, seats, any_car_ok,
                                   status, decided_at)
      values (v_ride.id, v_old.rider_id, v_candidate.pickup_seq, v_candidate.drop_seq,
              v_old.seats, true, v_status,
              case when v_status = 'CONFIRMED' then now() end)
      returning id into v_new;

      -- The old booking gives way: off the waitlist, or no longer looking.
      update public.bookings
         set status = 'CANCELLED', waitlist_rank = null, rematch_requested = false,
             decided_at = coalesce(case when status = 'WAITLISTED' then now() end, decided_at)
       where id = v_old.id;
      if v_old.status = 'WAITLISTED' then
        perform private.renumber_waitlist(v_old.ride_id);
      end if;

      if v_status = 'CONFIRMED' then
        -- "Placed in the 8:15 instead" (user flow 1 step 6).
        perform private.after_confirm(v_new, 'booking_moved');
      else
        insert into public.notifications_outbox (user_id, kind, payload)
        values (v_old.rider_id, 'booking_moved',
                jsonb_build_object('booking_id', v_new, 'ride_id', v_ride.id,
                                   'depart_at', v_ride.depart_at, 'status', v_status));
      end if;
      return v_new;
    end if;
  end loop;

  return null;
end
$$;

-- Requests already queued for the 22:00 ranking are decided now, by score as they would have
-- been, so nobody is left waiting for a round that no longer comes.
select private.allocate(r.id)
  from public.rides r
 where r.status in ('OPEN', 'FULL')
   and r.depart_at > now()
   and exists (
     select 1 from public.bookings b where b.ride_id = r.id and b.status = 'REQUESTED'
   );
