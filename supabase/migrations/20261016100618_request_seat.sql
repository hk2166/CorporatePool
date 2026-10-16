-- Requesting a seat (T-5.1, F-D1, F-D3, lld.md §2 and Q4 option A).
--
-- Until the ride's allocation time (22:00 the evening before) a request only queues as
-- REQUESTED: seats then go to the most reliable riders (T-5.2), so being quick on the phone
-- doesn't beat being reliable. After it, a request takes a free seat at once (CONFIRMED) or
-- joins the end of the waitlist (WAITLISTED). Only the server calls this, after checking who's
-- asking.
--
-- Every function that changes seats locks the ride row first, so requests, allocation and
-- cancellations on one ride take turns. Seats themselves only ever change through
-- private.take_seats() and private.give_back_seats(): the conditional UPDATE in lld.md §2.

-- ---------------------------------------------------------------------------------------------
-- Seats. Never read-then-write a seat count: one conditional UPDATE decides. Returns false
-- (and changes nothing) if the seats aren't there.

create function private.take_seats(p_ride_id uuid, p_seats smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
begin
  update public.rides r
     set seats_left = r.seats_left - p_seats,
         status = case when r.seats_left - p_seats = 0 then 'FULL' else r.status end
   where r.id = p_ride_id and r.status = 'OPEN' and r.seats_left >= p_seats
  returning * into v_ride;
  if not found then
    return false;
  end if;
  -- "Your car is full for tomorrow" (F-E2, user flow 3 step 4).
  if v_ride.status = 'FULL' then
    insert into public.notifications_outbox (user_id, kind, payload)
    values (v_ride.owner_id, 'ride_full',
            jsonb_build_object('ride_id', v_ride.id, 'depart_at', v_ride.depart_at));
  end if;
  return true;
end
$$;

-- The mirror image, for cancellations: seats back, and a full car open again.
create function private.give_back_seats(p_ride_id uuid, p_seats smallint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rides r
     set seats_left = r.seats_left + p_seats,
         status = case when r.status = 'FULL' then 'OPEN' else r.status end
   where r.id = p_ride_id and r.status in ('OPEN', 'FULL')
$$;

-- What happens after any booking is confirmed (on request, at allocation, on promotion): the
-- rider is told, and their other requests for rides around the same time are withdrawn, since
-- they can only be in one car (lld.md §8). Returns nothing; the caller has already locked the
-- ride and taken the seats.
create function private.after_confirm(p_booking_id uuid, p_kind text default 'booking_confirmed')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_depart timestamptz;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;
  select r.depart_at into v_depart from public.rides r where r.id = v_booking.ride_id;

  insert into public.notifications_outbox (user_id, kind, payload)
  values (v_booking.rider_id, p_kind,
          jsonb_build_object('booking_id', v_booking.id, 'ride_id', v_booking.ride_id,
                             'depart_at', v_depart));

  with withdrawn as (
    update public.bookings b
       set status = 'CANCELLED', decided_at = now(), waitlist_rank = null
      from public.rides r
     where r.id = b.ride_id
       and b.rider_id = v_booking.rider_id
       and b.id <> v_booking.id
       and b.status in ('REQUESTED', 'WAITLISTED')
       and r.depart_at between v_depart - interval '3 hours' and v_depart + interval '3 hours'
    returning b.id, b.ride_id
  )
  insert into public.notifications_outbox (user_id, kind, payload)
  select v_booking.rider_id, 'request_withdrawn',
         jsonb_build_object('booking_id', w.id, 'ride_id', w.ride_id,
                            'because_of_ride_id', v_booking.ride_id)
    from withdrawn w;
end
$$;

-- The next place on a ride's waitlist.
create function private.next_waitlist_rank(p_ride_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(b.waitlist_rank), 0) + 1
    from public.bookings b
   where b.ride_id = p_ride_id and b.status = 'WAITLISTED'
$$;

revoke execute on function private.take_seats(uuid, smallint) from public;
revoke execute on function private.give_back_seats(uuid, smallint) from public;
revoke execute on function private.after_confirm(uuid, text) from public;
revoke execute on function private.next_waitlist_rank(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- The request itself.

create function public.request_seat(
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

  if now() < v_ride.allocation_at
     -- Allocation time has passed but the ranked allocation hasn't run yet: queue behind the
     -- riders who asked in time rather than jump ahead of them.
     or exists (
       select 1 from public.bookings b
        where b.ride_id = p_ride_id and b.status = 'REQUESTED'
     ) then
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

revoke execute on function public.request_seat(uuid, uuid, smallint, smallint, smallint, boolean)
  from public, anon, authenticated;
grant execute on function public.request_seat(uuid, uuid, smallint, smallint, smallint, boolean)
  to service_role;
