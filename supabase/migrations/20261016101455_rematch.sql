-- Cross-car matching (T-5.4, F-D6, lld.md §5, user flows 4 and 7): no car leaves empty while
-- someone is waiting. Riders who ticked "any car that fits is fine" are moved to another car
-- on their route, around the same time, that has room:
--
-- * waitlisted riders (their car filled up), only into a car where a seat can be confirmed
--   right now, so nobody gives up a place in line for a maybe;
-- * riders whose ride the owner cancelled (cancel_ride() flagged them), into any such car:
--   confirmed if seats are being handed out first come, or queued as a request if that car's
--   allocation is still to come.
--
-- It uses the same matcher as search (private.match_rides), within an hour either side of the
-- original pickup time, best fit first.

create function private.rematch(p_booking_id uuid)
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

    if now() >= v_ride.allocation_at then
      -- Seats are being handed out first come: place the rider if one is free right now.
      perform private.allocate(v_ride.id);
      if private.take_seats(v_ride.id, v_old.seats) then
        v_status := 'CONFIRMED';
      end if;
    elsif v_old.status = 'CANCELLED' then
      -- Seats here are handed out later by reliability: queue with everyone else.
      v_status := 'REQUESTED';
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

revoke execute on function private.rematch(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Everyone who could be moved: waitlisted "any car" riders on rides still to leave, and riders
-- of cancelled rides who haven't been placed yet. Riders of a cancelled ride stop being looked
-- for once their original time has passed. Runs every 5 minutes, after each allocation run,
-- and straight after an owner cancels. Returns how many riders it moved.

create function public.run_rematch()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_moved integer := 0;
begin
  update public.bookings b
     set rematch_requested = false
    from public.rides r
   where r.id = b.ride_id and b.rematch_requested and r.depart_at <= now();

  for v_booking_id in
    select b.id
      from public.bookings b
      join public.rides r on r.id = b.ride_id
     where r.depart_at > now()
       and ((b.status = 'WAITLISTED' and b.any_car_ok)
            or (b.status = 'CANCELLED' and b.rematch_requested))
     order by b.waitlist_rank nulls first, b.created_at
  loop
    begin
      if private.rematch(v_booking_id) is not null then
        v_moved := v_moved + 1;
      end if;
    exception when others then
      raise warning 'rematch failed for booking %: %', v_booking_id, sqlerrm;
    end;
  end loop;
  return v_moved;
end
$$;

revoke execute on function public.run_rematch() from public, anon, authenticated;
grant execute on function public.run_rematch() to service_role;

select cron.schedule('rematch-riders', '*/5 * * * *', $job$select public.run_rematch()$job$);

-- ---------------------------------------------------------------------------------------------
-- run_allocation() from T-5.2, now finishing with cross-car matching, so riders waitlisted at
-- 22:00 who'd take any car are placed in the same run (user flow 4 step 3).

create or replace function public.run_allocation()
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
  if v_rides > 0 then
    perform public.run_rematch();
  end if;
  return v_rides;
end
$$;
