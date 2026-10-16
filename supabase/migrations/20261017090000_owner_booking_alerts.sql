-- Owners hear about bookings as they come in: a push when a rider asks for a seat or gets one
-- straight away (and when a rider is moved into their car), with the rider's name, where they
-- get in and out, and how many have booked so far. The details are on the Riders page.
--
-- A trigger rather than a line in each function: request_seat() and rematch both create
-- bookings, and so may whatever comes next. Waitlisted riders have no seat, so the owner
-- isn't told about them; a confirmation that comes later (at 22:00, or off the waitlist) is a
-- rider the owner has already heard about.

create function private.tell_owner_of_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride public.rides;
begin
  if new.status not in ('REQUESTED', 'CONFIRMED') then
    return null;
  end if;
  select * into v_ride from public.rides r where r.id = new.ride_id;
  insert into public.notifications_outbox (user_id, kind, payload)
  select v_ride.owner_id, 'rider_booked',
         jsonb_build_object(
           'ride_id', new.ride_id,
           'booking_id', new.id,
           'depart_at', v_ride.depart_at,
           'status', new.status,
           'rider', (select u.name from public.users u where u.id = new.rider_id),
           'from', (select s.label from public.ride_stops s
                     where s.ride_id = new.ride_id and s.seq = new.pickup_seq),
           'to', (select s.label from public.ride_stops s
                   where s.ride_id = new.ride_id and s.seq = new.drop_seq),
           'riders', (select count(*) from public.bookings b
                       where b.ride_id = new.ride_id and b.status in ('REQUESTED', 'CONFIRMED'))
         );
  return null;
end
$$;

revoke execute on function private.tell_owner_of_booking() from public;

create trigger bookings_tell_owner
  after insert on public.bookings
  for each row execute function private.tell_owner_of_booking();
