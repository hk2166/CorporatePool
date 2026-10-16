-- Seat allocation (T-5.2, F-D2, lld.md §4, Q4 option A): at the ride's allocation time (22:00
-- the evening before), the requests that queued up are ranked by reliability score, highest
-- first, and earliest first among equals. Seats go down the list; whoever doesn't fit is
-- waitlisted in the same order. A job inside the database does it every 5 minutes, and a
-- request that arrives first triggers it for its ride straight away.

-- ---------------------------------------------------------------------------------------------
-- One ride. Safe to run any number of times: it only ever looks at requests still REQUESTED,
-- and after it runs there are none. Returns how many requests it decided.

create function private.allocate(p_ride_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
  v_rank integer;
  v_decided integer := 0;
begin
  -- Requests, cancellations and the job take turns on a ride.
  perform 1 from public.rides r where r.id = p_ride_id for update;
  v_rank := private.next_waitlist_rank(p_ride_id) - 1;

  for v_request in
    select b.id, b.rider_id, b.seats
      from public.bookings b
      join public.users u on u.id = b.rider_id
     where b.ride_id = p_ride_id and b.status = 'REQUESTED'
     order by u.reliability_score desc, b.created_at, b.id
  loop
    -- Confirming someone withdraws their requests on other rides (after_confirm), never on
    -- this one, so every request picked up here is still waiting.
    if private.take_seats(p_ride_id, v_request.seats) then
      update public.bookings set status = 'CONFIRMED', decided_at = now()
       where id = v_request.id;
      perform private.after_confirm(v_request.id);
    else
      -- Doesn't fit (the car is full, or they want more seats than are left): next in line.
      -- A smaller request further down can still take a seat that's left.
      v_rank := v_rank + 1;
      update public.bookings set status = 'WAITLISTED', waitlist_rank = v_rank, decided_at = now()
       where id = v_request.id;
      insert into public.notifications_outbox (user_id, kind, payload)
      values (v_request.rider_id, 'booking_waitlisted',
              jsonb_build_object('booking_id', v_request.id, 'ride_id', p_ride_id,
                                 'rank', v_rank));
    end if;
    v_decided := v_decided + 1;
  end loop;

  return v_decided;
end
$$;

revoke execute on function private.allocate(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- The job: every ride whose allocation time has passed and that still has requests waiting.
-- One ride's problem doesn't stop the others. Returns how many rides it allocated.

create function public.run_allocation()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride_id uuid;
  v_rides integer := 0;
begin
  for v_ride_id in
    select r.id
      from public.rides r
     where r.allocation_at <= now()
       and r.depart_at > now()
       and r.status in ('OPEN', 'FULL')
       and exists (
         select 1 from public.bookings b where b.ride_id = r.id and b.status = 'REQUESTED'
       )
     order by r.allocation_at, r.id
  loop
    begin
      perform private.allocate(v_ride_id);
      v_rides := v_rides + 1;
    exception when others then
      raise warning 'allocation failed for ride %: %', v_ride_id, sqlerrm;
    end;
  end loop;
  return v_rides;
end
$$;

revoke execute on function public.run_allocation() from public, anon, authenticated;
grant execute on function public.run_allocation() to service_role;

select cron.schedule('allocate-seats', '*/5 * * * *', $job$select public.run_allocation()$job$);

-- ---------------------------------------------------------------------------------------------
-- request_seat() from T-5.1, changed in two places: a request that arrives after allocation
-- time, before the job has got to its ride, allocates the ride first instead of queueing; and
-- a rider who already has a confirmed seat around the same time can't ask for another.

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

  -- Allocation time has passed but the job hasn't got to this ride yet: allocate now, so the
  -- riders who asked in time are ranked first and this request comes after them.
  if now() >= v_ride.allocation_at then
    perform private.allocate(p_ride_id);
  end if;

  if now() < v_ride.allocation_at then
    v_status := 'REQUESTED';
  elsif private.take_seats(p_ride_id, p_seats) then
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

