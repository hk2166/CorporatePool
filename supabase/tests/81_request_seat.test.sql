-- request_seat() (T-5.1, lld.md §2, Q4). The race for the last seat between two real
-- connections is in supabase/tests/race/last_seat.sh.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- People (all fake). O owns the cars; R1–R5 ride; N has no phone; W is a woman; M a man.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000040' || n)::uuid, 'demo.request' || n || '@example.com'
  from unnest(array['0', '1', '2', '3', '4', '5', '6', '7', '8']) as n;
insert into users (id, name, phone, gender) values
  ('00000000-0000-0000-0000-000000000400', 'Demo Owner', '+919999940000', null),
  ('00000000-0000-0000-0000-000000000401', 'Demo Rider One', '+919999940001', null),
  ('00000000-0000-0000-0000-000000000402', 'Demo Rider Two', '+919999940002', null),
  ('00000000-0000-0000-0000-000000000403', 'Demo Rider Three', '+919999940003', null),
  ('00000000-0000-0000-0000-000000000404', 'Demo Rider Four', '+919999940004', null),
  ('00000000-0000-0000-0000-000000000405', 'Demo Rider Five', '+919999940005', null),
  ('00000000-0000-0000-0000-000000000406', 'Demo No Phone', null, null),
  ('00000000-0000-0000-0000-000000000407', 'Demo Woman', '+919999940007', 'female'),
  ('00000000-0000-0000-0000-000000000408', 'Demo Man', '+919999940008', 'male');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000400',
   'Demo Car', 'White', 'HR26DM0400', 4);

-- Rides by name, departing p_depart from now, allocating p_alloc from now.
create temporary table names (name text primary key, id uuid not null) on commit drop;
create function pg_temp.ride(p_name text, p_depart interval, p_alloc interval,
                             p_seats smallint default 3, p_status ride_status default 'OPEN',
                             p_women_only boolean default false)
returns void language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat, status, women_only)
  values (v_id, '00000000-0000-0000-0000-000000000400', '20000000-0000-0000-0000-000000000400',
          now() + p_depart, now() + least(p_alloc, p_depart), p_seats, p_seats, 100, p_status,
          p_women_only);
  insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
  select v_id, s, extensions.st_makepoint(77.3 - s * 0.1, 28.1 + s * 0.2)::extensions.geography,
         'Demo Stop ' || s, s * 30
    from generate_series(0, 2) s;
  insert into names values (p_name, v_id);
end
$$;
create function pg_temp.id(p_name text) returns uuid language sql as $$
  select id from names where name = p_name
$$;
create function pg_temp.rider(p_n text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000040' || p_n)::uuid
$$;
-- request_seat() as a short string: "CONFIRMED", "WAITLISTED #2" …
create function pg_temp.ask(p_rider text, p_ride text, p_seats smallint default 1,
                            p_pickup smallint default 0, p_drop smallint default 2)
returns text language sql as $$
  select r.status || coalesce(' #' || r.waitlist_rank, '')
    from request_seat(pg_temp.rider(p_rider), pg_temp.id(p_ride), p_pickup, p_drop, p_seats) r
$$;
create function pg_temp.seats(p_ride text) returns text language sql as $$
  select seats_left || ' ' || status from rides where id = pg_temp.id(p_ride)
$$;
create function pg_temp.outbox(p_rider text, p_kind text) returns bigint language sql as $$
  select count(*) from notifications_outbox where user_id = pg_temp.rider(p_rider) and kind = p_kind
$$;

select pg_temp.ride('tomorrow',  '2 days',   '1 day');                -- seats not handed out yet
select pg_temp.ride('soon',      '10 hours', '-1 hour');              -- handed out: first come
select pg_temp.ride('soon later','11 hours', '5 hours');              -- an hour after "soon"
select pg_temp.ride('pending',   '10 hours', '-1 minute');            -- allocation still to run
select pg_temp.ride('cancelled', '10 hours', '-1 hour', p_status => 'CANCELLED');
select pg_temp.ride('women',     '10 hours', '-1 hour', p_women_only => true);
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq)
values (pg_temp.id('pending'), pg_temp.rider('4'), 0, 2);

-- Before allocation time --------------------------------------------------------------------- 2

select is(pg_temp.ask('1', 'tomorrow'), 'REQUESTED',
  'before 22:00 the evening before, a request only queues');
select is(pg_temp.seats('tomorrow'), '3 OPEN', 'and takes no seat yet');

-- After it: first come, first served --------------------------------------------------------- 13

select is(pg_temp.ask('5', 'soon later'), 'REQUESTED', 'R5 asks for the later car too');
select is(pg_temp.ask('5', 'soon'), 'CONFIRMED', 'after allocation time, a free seat is confirmed');
select is(pg_temp.seats('soon'), '2 OPEN', 'and the seat is taken');
select is(pg_temp.outbox('5', 'booking_confirmed'), 1::bigint, 'R5 is told');
select is(
  (select status::text from bookings where rider_id = pg_temp.rider('5') and ride_id = pg_temp.id('soon later')),
  'CANCELLED',
  'R5''s request for a car an hour later is withdrawn: they can only be in one'
);
select is(pg_temp.outbox('5', 'request_withdrawn'), 1::bigint, 'and they''re told that too');

select is(pg_temp.ask('1', 'soon'), 'CONFIRMED', 'R1 gets the next seat');
select is(pg_temp.ask('2', 'soon', 2::smallint), 'WAITLISTED #1',
  'R2 wants two seats but one is left: first on the waitlist');
select is(pg_temp.outbox('2', 'booking_waitlisted'), 1::bigint, 'R2 is told their place');
select is(pg_temp.ask('3', 'soon'), 'CONFIRMED', 'R3 takes the last seat');
select is(pg_temp.seats('soon'), '0 FULL', 'the car is full');
select is(pg_temp.outbox('0', 'ride_full'), 1::bigint, 'and the owner hears "your car is full"');
select is(pg_temp.ask('4', 'soon'), 'WAITLISTED #2', 'R4 is second on the waitlist');

-- Allocation not run yet ----------------------------------------------------------------------- 2

select is(pg_temp.ask('1', 'pending'), 'REQUESTED',
  'past allocation time but not yet allocated: queue behind those who asked in time');
select is(pg_temp.seats('pending'), '3 OPEN', 'no seat jumped the queue');

-- Who can't ------------------------------------------------------------------------------------ 13

select throws_ok($$ select pg_temp.ask('6', 'soon') $$, 'P0001', 'Add your phone number first',
  'no phone number, no seat');
select throws_ok(
  $$ select request_seat('00000000-0000-0000-0000-000000000400', pg_temp.id('tomorrow'), 0::smallint, 2::smallint) $$,
  'P0001', 'This is your own ride', 'an owner can''t book their own car');
select throws_ok($$ select pg_temp.ask('1', 'tomorrow') $$, 'P0001',
  'You''ve already asked for a seat on this ride', 'one request per ride');
select throws_ok($$ select pg_temp.ask('2', 'tomorrow', 1::smallint, 2::smallint, 1::smallint) $$,
  'P0001', 'Pick a pickup stop before your drop stop', 'no riding backwards');
select throws_ok($$ select pg_temp.ask('2', 'tomorrow', 1::smallint, 0::smallint, 7::smallint) $$,
  'P0001', 'Pick a pickup stop before your drop stop', 'stops must be on the route');
select throws_ok($$ select pg_temp.ask('2', 'tomorrow', 0::smallint) $$,
  'P0001', 'Ask for between 1 and 3 seats', 'at least one seat');
select throws_ok($$ select pg_temp.ask('2', 'tomorrow', 4::smallint) $$,
  'P0001', 'Ask for between 1 and 3 seats', 'no more seats than the car offers');
select throws_ok($$ select pg_temp.ask('2', 'cancelled') $$,
  'P0001', 'This ride isn''t taking requests', 'a cancelled ride takes no requests');

update rides set depart_at = now() - interval '1 minute', allocation_at = now() - interval '1 hour'
 where id = pg_temp.id('pending');
select throws_ok($$ select pg_temp.ask('2', 'pending') $$,
  'P0001', 'This ride isn''t taking requests', 'nor does one that has left');

insert into blocks values (pg_temp.rider('0'), pg_temp.rider('2'));
select throws_ok($$ select pg_temp.ask('2', 'tomorrow') $$,
  'P0001', 'This ride isn''t taking requests',
  'a rider the owner blocked gets the same answer as for a closed ride');
delete from blocks;

select throws_ok($$ select pg_temp.ask('8', 'women') $$,
  'P0001', 'This ride is for women only', 'a women-only ride refuses a man');
select is(pg_temp.ask('7', 'women'), 'CONFIRMED', 'and takes a woman');

select throws_ok($$ select request_seat(pg_temp.rider('1'), gen_random_uuid(), 0::smallint, 2::smallint) $$,
  'P0002', 'No such ride', 'an unknown ride');

-- Access --------------------------------------------------------------------------------------- 2

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000402"}', true);
select throws_ok(
  $$ select request_seat('00000000-0000-0000-0000-000000000402', gen_random_uuid(), 0::smallint, 2::smallint) $$,
  '42501', null,
  'riders can''t call it from the browser: the server does, after checking who''s asking');
set local role anon;
select throws_ok(
  $$ select request_seat('00000000-0000-0000-0000-000000000402', gen_random_uuid(), 0::smallint, 2::smallint) $$,
  '42501', null, 'nor can visitors');

select * from finish();
rollback;
