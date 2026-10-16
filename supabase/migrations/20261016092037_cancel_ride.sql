-- Cancelling a ride (T-3.5, F-B4, user flow 7).
--
-- One transaction: the ride is cancelled, every booking still in play on it is cancelled, each
-- affected rider gets a "ride cancelled" notification queued, and riders who said "any car that
-- fits is fine" are flagged so cross-car matching (T-5.4) can find them another seat. Only the
-- server calls it, after checking who's asking.

-- Set when a booking is cancelled because its ride was, and the rider is happy with any car.
-- Cross-car matching (T-5.4, lld.md §5) picks these up and clears the flag.
alter table public.bookings
  add column rematch_requested boolean not null default false;

create index bookings_rematch_idx on public.bookings (created_at) where rematch_requested;

create function public.cancel_ride(
  p_owner_id uuid,
  p_ride_id uuid,
  p_reason text default null
)
returns integer                     -- how many riders were affected
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 200), '');
  v_had_confirmed boolean;
  v_affected integer;
begin
  -- Lock the ride so a booking can't be confirmed while it's being cancelled.
  select * into v_ride from public.rides r
   where r.id = p_ride_id and r.owner_id = p_owner_id
   for update;
  if not found then
    raise exception 'No such ride' using errcode = 'P0002';
  end if;
  if v_ride.status not in ('OPEN', 'ALLOCATING', 'FULL') or v_ride.depart_at <= now() then
    raise exception 'This ride can no longer be cancelled'
      using errcode = 'P0001', hint = 'NOT_CANCELLABLE';
  end if;

  select exists (
    select 1 from public.bookings b where b.ride_id = p_ride_id and b.status = 'CONFIRMED'
  ) into v_had_confirmed;

  update public.rides set status = 'CANCELLED' where id = p_ride_id;

  with cancelled as (
    update public.bookings b
       set status = 'CANCELLED',
           decided_at = now(),
           waitlist_rank = null,
           rematch_requested = b.any_car_ok
     where b.ride_id = p_ride_id
       and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
    returning b.id, b.rider_id, b.any_car_ok
  ),
  notified as (
    insert into public.notifications_outbox (user_id, kind, payload)
    select c.rider_id, 'ride_cancelled',
           jsonb_build_object(
             'ride_id', p_ride_id,
             'booking_id', c.id,
             'depart_at', v_ride.depart_at,
             'reason', v_reason,
             'finding_another_car', c.any_car_ok
           )
      from cancelled c
    returning 1
  )
  select count(*) into v_affected from notified;

  -- Cancelling after seats were handed out (22:00 the evening before), with riders counting on
  -- it, costs the owner reliability once per ride (lld.md §3, F-F6).
  if v_had_confirmed and now() >= v_ride.allocation_at then
    insert into public.reliability_events (user_id, kind, ride_id, points)
    values (p_owner_id, 'OWNER_LATE_CANCEL', p_ride_id, -5)
    on conflict do nothing;
  end if;

  return v_affected;
end
$$;

revoke execute on function public.cancel_ride(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_ride(uuid, uuid, text) to service_role;
