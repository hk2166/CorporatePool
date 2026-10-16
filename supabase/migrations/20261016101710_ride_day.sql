-- The morning of the ride (T-5.6, F-B8, user flow 3 step 5, lld.md §8): the owner taps Start,
-- marks each rider picked up or a no-show, and taps Complete at the office. These outcomes
-- are what reliability scores are built from (lld.md §3):
--
--   completed ride   +2    (COMPLETED event)
--   no-show         -15    (NO_SHOW event)
--
-- Owners forget, so a job completes every ride 3 hours after departure, and anyone not marked
-- a no-show by then counts as having ridden: forgetting never hurts riders. Only the server
-- calls the owner's functions, after checking who's asking.

alter table public.bookings add column picked_up_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- Helpers.

-- A ride the owner is driving today, locked; refuses anyone else's ride.
create function private.owned_ride_for_update(p_owner_id uuid, p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
begin
  select r.* into v_ride from public.rides r
   where r.id = p_ride_id and r.owner_id = p_owner_id
   for update;
  if not found then
    raise exception 'No such ride' using errcode = 'P0002';
  end if;
  return v_ride;
end
$$;

-- Requests and waitlist places that never turned into a seat end when the car leaves.
create function private.expire_waiting(p_ride_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.bookings b
       set status = 'EXPIRED', waitlist_rank = null, decided_at = now()
     where b.ride_id = p_ride_id and b.status in ('REQUESTED', 'WAITLISTED')
    returning b.id, b.rider_id
  )
  insert into public.notifications_outbox (user_id, kind, payload)
  select e.rider_id, 'booking_expired', jsonb_build_object('booking_id', e.id, 'ride_id', p_ride_id)
    from expired e
$$;

-- Finishes a ride: everyone still confirmed rode (+2 each), and the ride is COMPLETED.
create function private.finish_ride(p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.expire_waiting(p_ride_id);

  with completed as (
    update public.bookings b
       set status = 'COMPLETED', decided_at = now()
     where b.ride_id = p_ride_id and b.status = 'CONFIRMED'
    returning b.id, b.rider_id
  ),
  scored as (
    insert into public.reliability_events (user_id, kind, booking_id, points)
    select c.rider_id, 'COMPLETED', c.id, 2 from completed c
    on conflict do nothing
    returning user_id, booking_id
  )
  -- "Pay ₹150 by UPI" reminder for after the ride (F-D8).
  insert into public.notifications_outbox (user_id, kind, payload)
  select s.user_id, 'ride_completed',
         jsonb_build_object('booking_id', s.booking_id, 'ride_id', p_ride_id)
    from scored s;

  update public.rides set status = 'COMPLETED' where id = p_ride_id;
end
$$;

revoke execute on function private.owned_ride_for_update(uuid, uuid) from public;
revoke execute on function private.expire_waiting(uuid) from public;
revoke execute on function private.finish_ride(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Start: from an hour before departure. Seats are settled from here on.

create function public.start_ride(p_owner_id uuid, p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides := private.owned_ride_for_update(p_owner_id, p_ride_id);
begin
  if v_ride.status not in ('OPEN', 'FULL') then
    raise exception 'This ride can''t be started' using errcode = 'P0001', hint = 'NOT_STARTABLE';
  end if;
  if now() < v_ride.depart_at - interval '1 hour' then
    raise exception 'You can start the ride from an hour before it leaves' using errcode = 'P0001',
      hint = 'TOO_EARLY';
  end if;

  update public.rides set status = 'STARTED' where id = p_ride_id;
  perform private.expire_waiting(p_ride_id);

  insert into public.notifications_outbox (user_id, kind, payload)
  select b.rider_id, 'ride_started', jsonb_build_object('booking_id', b.id, 'ride_id', p_ride_id)
    from public.bookings b
   where b.ride_id = p_ride_id and b.status = 'CONFIRMED';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Marking a rider, while the ride is under way: 'picked_up', 'no_show', or 'undo' for a wrong
-- tap. A no-show costs the rider 15 points (and they're told, so they can dispute it, F-F5);
-- undoing it gives them back.

create function public.mark_rider(p_owner_id uuid, p_booking_id uuid, p_outcome text)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_ride public.rides;
begin
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'No such booking' using errcode = 'P0002';
  end if;
  v_ride := private.owned_ride_for_update(p_owner_id, v_booking.ride_id);
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;

  if v_ride.status <> 'STARTED' then
    raise exception 'Start the ride first' using errcode = 'P0001', hint = 'NOT_STARTED';
  end if;
  if v_booking.status not in ('CONFIRMED', 'NO_SHOW') then
    raise exception 'This rider isn''t on the ride' using errcode = 'P0001', hint = 'NOT_ON_RIDE';
  end if;

  if p_outcome = 'picked_up' then
    if v_booking.status = 'NO_SHOW' then
      raise exception 'Undo the no-show first' using errcode = 'P0001', hint = 'IS_NO_SHOW';
    end if;
    update public.bookings set picked_up_at = coalesce(picked_up_at, now()) where id = p_booking_id;
  elsif p_outcome = 'no_show' then
    if v_booking.picked_up_at is not null then
      raise exception 'This rider was picked up' using errcode = 'P0001', hint = 'PICKED_UP';
    end if;
    if v_booking.status = 'CONFIRMED' then
      update public.bookings set status = 'NO_SHOW', decided_at = now() where id = p_booking_id;
      insert into public.reliability_events (user_id, kind, booking_id, points)
      values (v_booking.rider_id, 'NO_SHOW', p_booking_id, -15)
      on conflict do nothing;
      insert into public.notifications_outbox (user_id, kind, payload)
      values (v_booking.rider_id, 'marked_no_show',
              jsonb_build_object('booking_id', p_booking_id, 'ride_id', v_ride.id));
    end if;
  elsif p_outcome = 'undo' then
    update public.bookings set status = 'CONFIRMED', picked_up_at = null where id = p_booking_id;
    delete from public.reliability_events where booking_id = p_booking_id and kind = 'NO_SHOW';
  else
    raise exception 'Unknown outcome %', p_outcome using errcode = '22023';
  end if;

  return (select b.status from public.bookings b where b.id = p_booking_id);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Complete, at the office. Everyone still confirmed rode.

create function public.complete_ride(p_owner_id uuid, p_ride_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides := private.owned_ride_for_update(p_owner_id, p_ride_id);
begin
  if v_ride.status <> 'STARTED' then
    raise exception 'Start the ride first' using errcode = 'P0001', hint = 'NOT_STARTED';
  end if;
  perform private.finish_ride(p_ride_id);
end
$$;

revoke execute on function public.start_ride(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mark_rider(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_ride(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_ride(uuid, uuid) to service_role;
grant execute on function public.mark_rider(uuid, uuid, text) to service_role;
grant execute on function public.complete_ride(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- The expiry job, every 5 minutes: at departure, requests and waitlist places that never got a
-- seat expire; 3 hours after departure, any ride not completed is completed (lld.md §8).
-- Returns how many rides it completed.

create function public.run_ride_expiry()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride_id uuid;
  v_completed integer := 0;
begin
  for v_ride_id in
    select r.id from public.rides r
     where r.depart_at <= now()
       and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED')
       and exists (
         select 1 from public.bookings b
          where b.ride_id = r.id and b.status in ('REQUESTED', 'WAITLISTED')
       )
  loop
    perform 1 from public.rides r where r.id = v_ride_id for update;
    perform private.expire_waiting(v_ride_id);
  end loop;

  for v_ride_id in
    select r.id from public.rides r
     where r.depart_at <= now() - interval '3 hours'
       and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED')
     order by r.depart_at
  loop
    begin
      perform 1 from public.rides r where r.id = v_ride_id for update;
      perform private.finish_ride(v_ride_id);
      v_completed := v_completed + 1;
    exception when others then
      raise warning 'expiry failed for ride %: %', v_ride_id, sqlerrm;
    end;
  end loop;
  return v_completed;
end
$$;

revoke execute on function public.run_ride_expiry() from public, anon, authenticated;
grant execute on function public.run_ride_expiry() to service_role;

select cron.schedule('expire-rides', '*/5 * * * *', $job$select public.run_ride_expiry()$job$);
