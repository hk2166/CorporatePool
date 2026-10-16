-- A rider cancelling, and the waitlist moving up (T-5.3, F-D4, F-D7, lld.md §5, user flow 5).
--
-- When a confirmed rider cancels, the seat goes back and the first person on the waitlist who
-- fits gets it in the same transaction; the owner does nothing and the car still leaves full.
-- A 5-minute sweep repeats the promotion for any ride with a free seat and a waitlist, as a
-- safety net.

-- ---------------------------------------------------------------------------------------------
-- Waitlist promotion for one ride: free seats go down the waitlist in order. Someone who wants
-- more seats than are free keeps their place, and a smaller request behind them can take what's
-- left. The rest of the line then moves up (#3 becomes #2). Returns how many were promoted.
-- The caller holds the ride lock.

create function private.promote(p_ride_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_waiting record;
  v_promoted integer := 0;
begin
  if not exists (
    select 1 from public.rides r
     where r.id = p_ride_id and r.status = 'OPEN' and r.depart_at > now()
  ) then
    return 0;
  end if;

  for v_waiting in
    select b.id, b.seats
      from public.bookings b
     where b.ride_id = p_ride_id and b.status = 'WAITLISTED'
     order by b.waitlist_rank, b.id
  loop
    if private.take_seats(p_ride_id, v_waiting.seats) then
      update public.bookings
         set status = 'CONFIRMED', waitlist_rank = null, decided_at = now()
       where id = v_waiting.id;
      perform private.after_confirm(v_waiting.id, 'booking_promoted');
      v_promoted := v_promoted + 1;
    end if;
  end loop;

  perform private.renumber_waitlist(p_ride_id);
  return v_promoted;
end
$$;

-- Closes the gaps in a ride's waitlist, keeping the order.
create function private.renumber_waitlist(p_ride_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings b
     set waitlist_rank = n.rank
    from (
      select w.id, row_number() over (order by w.waitlist_rank, w.id)::integer as rank
        from public.bookings w
       where w.ride_id = p_ride_id and w.status = 'WAITLISTED'
    ) n
   where b.id = n.id and b.waitlist_rank <> n.rank
$$;

revoke execute on function private.promote(uuid) from public;
revoke execute on function private.renumber_waitlist(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- The rider cancels (F-D7). Only the server calls it, after checking who's asking.
--
-- Cancelling a confirmed seat after allocation time (22:00 the evening before) is a late
-- cancel: someone else could have had that seat, so it costs reliability (lld.md §3). Dropping
-- a request or a waitlist place never does. Returns whether it counted as late.

create function public.cancel_booking(p_rider_id uuid, p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_ride public.rides;
  v_late boolean;
begin
  select b.* into v_booking from public.bookings b
   where b.id = p_booking_id and b.rider_id = p_rider_id;
  if not found then
    raise exception 'No such booking' using errcode = 'P0002';
  end if;

  -- Lock the ride, then look at the booking again: it may have changed while we waited.
  select r.* into v_ride from public.rides r where r.id = v_booking.ride_id for update;
  select b.* into v_booking from public.bookings b where b.id = p_booking_id;

  if v_booking.status not in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
     or v_ride.status not in ('OPEN', 'ALLOCATING', 'FULL')
     or v_ride.depart_at <= now() then
    raise exception 'This booking can no longer be cancelled' using errcode = 'P0001',
      hint = 'NOT_CANCELLABLE';
  end if;

  v_late := v_booking.status = 'CONFIRMED' and now() >= v_ride.allocation_at;

  update public.bookings
     set status = 'CANCELLED', decided_at = now(), waitlist_rank = null,
         rematch_requested = false
   where id = p_booking_id;

  if v_booking.status = 'CONFIRMED' then
    perform private.give_back_seats(v_ride.id, v_booking.seats);
    perform private.promote(v_ride.id);
  elsif v_booking.status = 'WAITLISTED' then
    perform private.renumber_waitlist(v_ride.id);
  end if;

  if v_late then
    insert into public.reliability_events (user_id, kind, booking_id, points)
    values (p_rider_id, 'LATE_CANCEL', p_booking_id, -5)
    on conflict do nothing;
  end if;

  -- The owner sees who dropped out (their rider list also updates live).
  if v_booking.status = 'CONFIRMED' then
    insert into public.notifications_outbox (user_id, kind, payload)
    values (v_ride.owner_id, 'booking_cancelled',
            jsonb_build_object('booking_id', p_booking_id, 'ride_id', v_ride.id,
                               'seats', v_booking.seats));
  end if;

  return v_late;
end
$$;

revoke execute on function public.cancel_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- The safety net: every 5 minutes, any ride that's still to leave with a free seat and a
-- waitlist promotes. Normally this finds nothing, because cancelling promotes straight away.
-- Returns how many riders it promoted.

create function public.run_promotion_sweep()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride_id uuid;
  v_promoted integer := 0;
begin
  for v_ride_id in
    select r.id
      from public.rides r
     where r.status = 'OPEN'
       and r.depart_at > now()
       and r.seats_left > 0
       and exists (
         select 1 from public.bookings b where b.ride_id = r.id and b.status = 'WAITLISTED'
       )
     order by r.depart_at, r.id
  loop
    begin
      perform 1 from public.rides r where r.id = v_ride_id for update;
      v_promoted := v_promoted + private.promote(v_ride_id);
    exception when others then
      raise warning 'promotion sweep failed for ride %: %', v_ride_id, sqlerrm;
    end;
  end loop;
  return v_promoted;
end
$$;

revoke execute on function public.run_promotion_sweep() from public, anon, authenticated;
grant execute on function public.run_promotion_sweep() to service_role;

select cron.schedule('promote-waitlist', '*/5 * * * *', $job$select public.run_promotion_sweep()$job$);
