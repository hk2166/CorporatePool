-- The morning of the ride (T-5.6): start, mark riders, complete, and the expiry job for owners
-- who forget (lld.md §8).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fake people: owner O ("0") and riders A–I, with ids ending 900 … 909.
create function pg_temp.rider(p_letter text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000009'
          || lpad((position(p_letter in '0abcdefghi') - 1)::text, 2, '0'))::uuid
$$;
insert into auth.users (id, email)
select pg_temp.rider(n), 'demo.rideday' || n || '@example.com'
  from unnest(string_to_array('0abcdefghi', null)) as n;
insert into users (id, name, phone)
select pg_temp.rider(n), 'Demo ' || upper(n), '+9199999900' || lpad(o::text, 2, '0')
  from unnest(string_to_array('0abcdefghi', null)) with ordinality as t(n, o);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000900',
   'Demo Car', 'White', 'HR26DM0900', 4);

create temporary table names (name text primary key, id uuid not null) on commit drop;
create function pg_temp.ride(p_name text, p_depart interval, p_seats smallint,
                             p_status ride_status default 'OPEN')
returns void language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat, status)
  values (v_id, '00000000-0000-0000-0000-000000000900', '20000000-0000-0000-0000-000000000900',
          now() + p_depart, now() + p_depart - interval '10 hours', p_seats,
          case when p_status in ('FULL', 'STARTED') then 0 else p_seats end, 100, p_status);
  insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
    (v_id, 0, extensions.st_makepoint(77.33, 28.14)::extensions.geography, 'Demo Start', 0),
    (v_id, 1, extensions.st_makepoint(77.09, 28.49)::extensions.geography, 'Demo End', 70);
  insert into names values (p_name, v_id);
end
$$;
create function pg_temp.id(p_name text) returns uuid language sql as $$
  select id from names where name = p_name
$$;
create function pg_temp.booking(p_letter text) returns uuid language sql as $$
  select id from bookings where rider_id = pg_temp.rider(p_letter) order by created_at desc limit 1
$$;
-- A booking placed directly, for rides that have already left.
create function pg_temp.place(p_letter text, p_ride text, p_status booking_status,
                              p_rank integer default null)
returns void language sql as $$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, waitlist_rank, decided_at)
  values (pg_temp.id(p_ride), pg_temp.rider(p_letter), 0, 1, p_status, p_rank, now() - interval '1 day')
$$;
create function pg_temp.status(p_letter text) returns text language sql as $$
  select status::text from bookings where id = pg_temp.booking(p_letter)
$$;
create function pg_temp.points(p_letter text) returns text language sql as $$
  select coalesce(string_agg(kind || ' ' || points, ', ' order by created_at), 'none')
    from reliability_events where user_id = pg_temp.rider(p_letter)
$$;

-- "today": leaves in 30 minutes, 2 seats: A and B have them, C is waitlisted.
select pg_temp.ride('today', '30 minutes', 2::smallint);
select pg_temp.ride('later', '3 hours', 2::smallint);
do $$
begin
  perform request_seat(pg_temp.rider('a'), pg_temp.id('today'), 0::smallint, 1::smallint);
  perform request_seat(pg_temp.rider('b'), pg_temp.id('today'), 0::smallint, 1::smallint);
  perform request_seat(pg_temp.rider('c'), pg_temp.id('today'), 0::smallint, 1::smallint);
end
$$;

-- Start ---------------------------------------------------------------------------------------- 5

select throws_ok($$ select start_ride(pg_temp.rider('0'), pg_temp.id('later')) $$,
  'P0001', 'You can start the ride from an hour before it leaves', 'not hours early');
select lives_ok($$ select start_ride(pg_temp.rider('0'), pg_temp.id('today')) $$,
  'the owner starts the ride half an hour before it leaves');
select is((select status::text from rides where id = pg_temp.id('today')), 'STARTED', 'it''s under way');
select is(pg_temp.status('c'), 'EXPIRED', 'C''s waitlist place ends: the car has left');
select is(
  (select count(*) from notifications_outbox where kind = 'ride_started' and payload ->> 'ride_id' = pg_temp.id('today')::text),
  2::bigint, 'A and B hear the car is on its way');

-- Marking riders -------------------------------------------------------------------------------- 9

select is(mark_rider(pg_temp.rider('0'), pg_temp.booking('a'), 'picked_up'), 'CONFIRMED'::booking_status,
  'A is picked up');
select ok((select picked_up_at is not null from bookings where id = pg_temp.booking('a')), 'and that''s recorded');
select is(mark_rider(pg_temp.rider('0'), pg_temp.booking('b'), 'no_show'), 'NO_SHOW'::booking_status,
  'B doesn''t turn up');
select is(pg_temp.points('b'), 'NO_SHOW -15', 'a no-show costs 15 points');
select is(
  (select count(*) from notifications_outbox where user_id = pg_temp.rider('b') and kind = 'marked_no_show'),
  1::bigint, 'B is told, so they can dispute it');
select is(mark_rider(pg_temp.rider('0'), pg_temp.booking('b'), 'undo'), 'CONFIRMED'::booking_status,
  'a wrong tap can be undone');
select is(pg_temp.points('b'), 'none', 'and the points come back');
select is(mark_rider(pg_temp.rider('0'), pg_temp.booking('b'), 'no_show'), 'NO_SHOW'::booking_status,
  'B really didn''t turn up');
select throws_ok($$ select mark_rider(pg_temp.rider('0'), pg_temp.booking('a'), 'no_show') $$,
  'P0001', 'This rider was picked up', 'someone who was picked up can''t be a no-show');

-- Complete (user flow 3 step 5) ---------------------------------------------------------------- 5

select lives_ok($$ select complete_ride(pg_temp.rider('0'), pg_temp.id('today')) $$,
  'the owner taps Complete at the office');
select is((select status::text from rides where id = pg_temp.id('today')), 'COMPLETED', 'the ride is done');
select is(pg_temp.status('a') || ' / ' || pg_temp.points('a'), 'COMPLETED / COMPLETED 2',
  'A rode: +2');
select is(pg_temp.status('b') || ' / ' || pg_temp.points('b'), 'NO_SHOW / NO_SHOW -15',
  'B stays a no-show and gets nothing for the ride');
select throws_ok($$ select mark_rider(pg_temp.rider('0'), pg_temp.booking('b'), 'undo') $$,
  'P0001', 'Start the ride first', 'nothing can be marked once the ride is complete');

-- The owner forgets (lld.md §8) ------------------------------------------------------------------ 6

-- "forgotten": left 4 hours ago, never started. D and E had seats, F was waitlisted.
-- "unfinished": left 4 hours ago, started, G marked a no-show, H never marked.
-- "just left": left 10 minutes ago, I still waitlisted.
select pg_temp.ride('forgotten', '-4 hours', 2::smallint, 'FULL');
select pg_temp.ride('unfinished', '-4 hours', 2::smallint, 'STARTED');
select pg_temp.ride('just left', '-10 minutes', 1::smallint, 'FULL');
select pg_temp.place('d', 'forgotten', 'CONFIRMED');
select pg_temp.place('e', 'forgotten', 'CONFIRMED');
select pg_temp.place('f', 'forgotten', 'WAITLISTED', 1);
select pg_temp.place('g', 'unfinished', 'NO_SHOW');
select pg_temp.place('h', 'unfinished', 'CONFIRMED');
select pg_temp.place('i', 'just left', 'WAITLISTED', 1);

select is(run_ride_expiry(), 2, 'the job completes both rides left 3+ hours ago');
select is(
  pg_temp.status('d') || ' ' || pg_temp.status('e') || ' / ' || pg_temp.points('d') || ' / ' || pg_temp.points('e'),
  'COMPLETED COMPLETED / COMPLETED 2 / COMPLETED 2',
  'never started: the riders count as having ridden, so the owner forgetting doesn''t hurt them');
select is(pg_temp.status('f'), 'EXPIRED', 'the waitlist place expired');
select is(pg_temp.status('g') || ' ' || pg_temp.status('h') || ' / ' || pg_temp.points('h'),
  'NO_SHOW COMPLETED / COMPLETED 2',
  'never completed: the marked no-show stands, the unmarked rider counts as having ridden');
select is(pg_temp.status('i') || ' / ' || (select status::text from rides where id = pg_temp.id('just left')),
  'EXPIRED / FULL', 'a car that just left: waitlist places end, the ride itself isn''t done yet');
select is(run_ride_expiry(), 0, 'running the job again changes nothing');

-- Access ------------------------------------------------------------------------------------------ 2

select throws_ok($$ select start_ride(pg_temp.rider('a'), pg_temp.id('later')) $$,
  'P0002', 'No such ride', 'only the owner can start their ride');
set local role authenticated;
select throws_ok($$ select run_ride_expiry() $$, '42501', null, 'nobody runs the job from the browser');

select * from finish();
rollback;
