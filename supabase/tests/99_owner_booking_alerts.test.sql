-- Owners hear about each booking as it comes in (20261017090000_owner_booking_alerts.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000090' || n)::uuid, 'demo.alert' || n || '@example.com'
  from unnest(array['0', '1', '2', '3']) as n;
insert into users (id, name, phone) values
  ('00000000-0000-0000-0000-000000000900', 'Demo Owner', '+919999990900'),
  ('00000000-0000-0000-0000-000000000901', 'Demo Rider One', '+919999990901'),
  ('00000000-0000-0000-0000-000000000902', 'Demo Rider Two', '+919999990902'),
  ('00000000-0000-0000-0000-000000000903', 'Demo Rider Three', '+919999990903');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000900',
   'Demo Car', 'White', 'HR26DM0900', 4);

-- Tomorrow's ride (seats not given out yet) and one leaving soon (first come, first served),
-- with one seat.
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('30000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000900',
   '20000000-0000-0000-0000-000000000900', now() + interval '2 days', now() + interval '1 day',
   3, 3, 100),
  ('30000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000900',
   '20000000-0000-0000-0000-000000000900', now() + interval '10 hours',
   now() - interval '1 hour', 1, 1, 100);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
select r, s, extensions.st_makepoint(77.3 - s * 0.1, 28.1 + s * 0.2)::extensions.geography,
       'Demo Stop ' || s, s * 30
  from unnest(array['30000000-0000-0000-0000-000000000901',
                    '30000000-0000-0000-0000-000000000902']::uuid[]) r,
       generate_series(0, 2) s;

create function pg_temp.alerts() returns setof notifications_outbox language sql as $$
  select * from notifications_outbox
   where user_id = '00000000-0000-0000-0000-000000000900' and kind = 'rider_booked'
$$;
-- The owner's alert about one rider's booking on one ride.
create function pg_temp.alert(p_rider text, p_ride text) returns jsonb language sql as $$
  select payload from pg_temp.alerts()
   where payload ->> 'rider' = 'Demo Rider ' || p_rider
     and payload ->> 'ride_id' = '30000000-0000-0000-0000-00000000090' || p_ride
$$;

-- A rider asks for tomorrow's ride ---------------------------------------------------------- 5

select request_seat('00000000-0000-0000-0000-000000000901',
                    '30000000-0000-0000-0000-000000000901', 0::smallint, 2::smallint);
select is((select count(*) from pg_temp.alerts()), 1::bigint,
  'the owner is told when a rider asks for a seat');
select isnt(pg_temp.alert('One', '1'), null, 'by name');
select is((select (a ->> 'from') || ' → ' || (a ->> 'to') from pg_temp.alert('One', '1') a),
  'Demo Stop 0 → Demo Stop 2', 'with where they get in and out');
select is(pg_temp.alert('One', '1') ->> 'status', 'REQUESTED',
  'and that they''re still asking');

select request_seat('00000000-0000-0000-0000-000000000902',
                    '30000000-0000-0000-0000-000000000901', 1::smallint, 2::smallint);
select is(pg_temp.alert('Two', '1') ->> 'riders', '2',
  'the next one says how many have booked so far');

-- The ride leaving soon: seats go first come, first served ---------------------------------- 3

select request_seat('00000000-0000-0000-0000-000000000903',
                    '30000000-0000-0000-0000-000000000902', 0::smallint, 2::smallint);
select is(pg_temp.alert('Three', '2') ->> 'status', 'CONFIRMED',
  'a seat taken straight away is a booking');
select request_seat('00000000-0000-0000-0000-000000000901',
                    '30000000-0000-0000-0000-000000000902', 0::smallint, 2::smallint);
select is((select status::text from bookings
            where rider_id = '00000000-0000-0000-0000-000000000901'
              and ride_id = '30000000-0000-0000-0000-000000000902'),
  'WAITLISTED', 'the car is full, so the next rider is waitlisted');
select is((select count(*) from pg_temp.alerts()), 3::bigint,
  'and the owner isn''t told about a waitlisted rider');

-- Seats given out later don't tell the owner twice ------------------------------------------- 1

update rides set allocation_at = now() - interval '1 minute'
 where id = '30000000-0000-0000-0000-000000000901';
select private.allocate('30000000-0000-0000-0000-000000000901');
select is((select count(*) from pg_temp.alerts()), 3::bigint,
  'confirming riders who already asked doesn''t tell the owner again');

select * from finish();
rollback;
