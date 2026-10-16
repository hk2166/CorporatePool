-- Blocking someone (T-6.5, F-F8). A blocked pair never matches again: search and requests
-- already leave them out (T-4.1, T-5.1). Here: the moment one blocks the other, any request,
-- waitlist place or seat between them on a ride still to come ends. A freed seat goes to the
-- waitlist as usual, and a rider happy with any car is looked after by cross-car matching
-- (T-5.4). No reliability points change: blocking isn't anyone's fault on the record.
--
-- People add blocks directly (their access rule allows it), so this runs as a trigger on the
-- blocks table and applies however a block is made.

create function private.on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
begin
  for v_booking in
    select b.id, b.ride_id, b.rider_id, b.status, b.seats, b.any_car_ok
      from public.bookings b
      join public.rides r on r.id = b.ride_id
     where b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
       and r.status in ('OPEN', 'ALLOCATING', 'FULL')
       and r.depart_at > now()
       and ((b.rider_id = new.blocked_id and r.owner_id = new.blocker_id)
            or (b.rider_id = new.blocker_id and r.owner_id = new.blocked_id))
     order by b.ride_id
  loop
    perform 1 from public.rides r where r.id = v_booking.ride_id for update;
    update public.bookings
       set status = 'CANCELLED', decided_at = now(), waitlist_rank = null,
           rematch_requested = v_booking.any_car_ok
     where id = v_booking.id;
    if v_booking.status = 'CONFIRMED' then
      perform private.give_back_seats(v_booking.ride_id, v_booking.seats);
      perform private.promote(v_booking.ride_id);
    elsif v_booking.status = 'WAITLISTED' then
      perform private.renumber_waitlist(v_booking.ride_id);
    end if;
    insert into public.notifications_outbox (user_id, kind, payload)
    values (v_booking.rider_id, 'booking_ended',
            jsonb_build_object('booking_id', v_booking.id, 'ride_id', v_booking.ride_id,
                               'finding_another_car', v_booking.any_car_ok));
  end loop;
  return null;
end
$$;

create trigger blocks_end_bookings
  after insert on public.blocks
  for each row execute function private.on_block();
