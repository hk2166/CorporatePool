-- Blocking (T-6.5, F-F8): a blocked pair never matches.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-000000000e0' || n)::uuid, 'demo.block' || n || '@example.com'
  from generate_series(0, 3) n;
insert into users (id, name, phone)
select ('00000000-0000-0000-0000-000000000e0' || n)::uuid, 'Demo Block ' || n, '+91999995010' || n
  from generate_series(0, 3) n;
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000e00', '00000000-0000-0000-0000-000000000e00',
   'Demo Car', 'White', 'HR26DM0E00', 4);
-- Owner 0's ride, seats handed out (first come): 1 seat. Rider 1 has it, rider 2 waits.
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat)
values ('30000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000e00',
        '20000000-0000-0000-0000-000000000e00', now() + interval '10 hours', now() - interval '1 hour', 1, 1, 100);
insert into ride_stops (ride_id, seq, geo, label)
select '30000000-0000-0000-0000-000000000e01', s, extensions.st_makepoint(77.3, 28.1 + s)::extensions.geography, 'Demo ' || s
  from generate_series(0, 1) s;
do $$
begin
  perform request_seat('00000000-0000-0000-0000-000000000e01', '30000000-0000-0000-0000-000000000e01', 0::smallint, 1::smallint, 1::smallint, true);
  perform request_seat('00000000-0000-0000-0000-000000000e02', '30000000-0000-0000-0000-000000000e01', 0::smallint, 1::smallint);
end
$$;

create function pg_temp.status(p_rider text) returns text language sql as $$
  select status::text from bookings where rider_id = ('00000000-0000-0000-0000-000000000e0' || p_rider)::uuid
   order by created_at desc limit 1
$$;

select is(pg_temp.status('1') || ' ' || pg_temp.status('2'), 'CONFIRMED WAITLISTED', 'the starting point');

-- The owner blocks rider 1, as a person would: directly, under the access rules.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000e00"}', true);
insert into blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-000000000e00', '00000000-0000-0000-0000-000000000e01');
reset role;

select is(pg_temp.status('1'), 'CANCELLED', 'rider 1''s seat on the owner''s ride ends');
select is(pg_temp.status('2'), 'CONFIRMED', 'and goes straight to rider 2, who was waiting');
select is(
  (select rematch_requested from bookings where rider_id = '00000000-0000-0000-0000-000000000e01'),
  true, 'rider 1 said any car is fine, so cross-car matching will look for another');
select is(
  (select count(*) from notifications_outbox where user_id = '00000000-0000-0000-0000-000000000e01' and kind = 'booking_ended'),
  1::bigint, 'rider 1 is told they''re no longer on that ride');
select is((select count(*) from reliability_events where user_id = '00000000-0000-0000-0000-000000000e01'),
  0::bigint, 'and loses no points for it');

select throws_ok(
  $$ select request_seat('00000000-0000-0000-0000-000000000e01', '30000000-0000-0000-0000-000000000e01', 0::smallint, 1::smallint) $$,
  'P0001', 'This ride isn''t taking requests',
  'a blocked rider''s request to that owner''s ride is refused (the task''s "done when")');

-- Blocking works the other way round too: rider 2 blocks the owner.
insert into blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000e00');
select is(pg_temp.status('2'), 'CANCELLED', 'a rider who blocks the owner leaves the ride');
select is((select seats_left || ' ' || status from rides where id = '30000000-0000-0000-0000-000000000e01'),
  '1 OPEN', 'and the seat is free again');

select * from finish();
rollback;
