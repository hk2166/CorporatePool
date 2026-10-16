-- Rules on usual_rides, rides and ride_stops (T-1.2, part 3).
-- Each rule gets a test that tries to break it. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- Tables exist, with Row-Level Security on (deny-all until T-1.3) --------------------------- 6

select has_table('public', t, format('%s exists', t))
  from unnest(array['usual_rides', 'rides', 'ride_stops']) as t;

select ok(c.relrowsecurity, format('RLS is on for %s', c.relname))
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('usual_rides', 'rides', 'ride_stops')
 order by c.relname;

-- Fixtures: two owners with one car each, and two stops (all fake, per task.md T-1.4)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'demo.owner.a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'demo.owner.b@example.com');
insert into users (id, name, phone) values
  ('00000000-0000-0000-0000-00000000000a', 'Demo Owner A', '+910000000010'),
  ('00000000-0000-0000-0000-00000000000b', 'Demo Owner B', '+910000000011');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
   'Demo Hatchback', 'White', 'HR26DM0010', 4),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b',
   'Demo Sedan', 'Grey', 'HR26DM0011', 4);
insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-00000000000a', 'Demo Start',
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography),
  ('10000000-0000-0000-0000-00000000000b', 'Demo End',
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography);

-- usual_rides -------------------------------------------------------------------------------- 8

select lives_ok($$
  insert into usual_rides (id, owner_id, car_id, depart_time, seats_offered, price_per_seat,
                           auto_golive_days, stops) values
    ('30000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
     '20000000-0000-0000-0000-00000000000a', '08:00', 3, 150, 31,
     '[{"label": "Demo Start"}, {"label": "Demo End", "eta_offset_min": 70}]')
$$, 'usual_rides: a valid template is accepted (auto go-live Mon–Fri)');

select throws_ok($$
  insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b',
          '08:00', 3, 150, '[{"label": "a"}, {"label": "b"}]')
$$, '23503', null, 'usual_rides: the car must belong to the owner');

select throws_ok($$
  insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
          '08:00', 0, 150, '[{"label": "a"}, {"label": "b"}]')
$$, '23514', null, 'usual_rides: at least one seat offered');

select throws_ok($$
  insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops)
  values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
          '08:00', 3, -1, '[{"label": "a"}, {"label": "b"}]')
$$, '23514', null, 'usual_rides: price can''t be negative');

select throws_ok($$
  update usual_rides set auto_golive_days = 128 where id = '30000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'usual_rides: weekday bitmask only has 7 days');

select throws_ok($$
  update usual_rides set stops = '{"label": "a"}' where id = '30000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'usual_rides: stops are a list');

select throws_ok($$
  update usual_rides set stops = '[{"label": "a"}]' where id = '30000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'usual_rides: at least a start and an end');

select throws_ok($$
  update usual_rides set notes = repeat('x', 281) where id = '30000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'usual_rides: notes are at most 280 characters');

-- rides ------------------------------------------------------------------------------------- 13

select lives_ok($$
  insert into rides (id, owner_id, car_id, usual_ride_id, depart_at, allocation_at,
                     seats_total, seats_left, price_per_seat) values
    ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a',
     '20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000a',
     '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 3, 150)
$$, 'rides: going live from a usual ride is accepted');

select throws_ok($$
  insert into rides (owner_id, car_id, usual_ride_id, depart_at, allocation_at,
                     seats_total, seats_left, price_per_seat) values
    ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-00000000000a',
     '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 3, 150)
$$, '23505', null, 'rides: going live twice for the same day creates one ride');

select lives_ok($$
  insert into rides (owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat) values
    ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
     '2026-10-21 08:00+05:30', '2026-10-20 22:00+05:30', 3, 3, 150),
    ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
     '2026-10-21 08:00+05:30', '2026-10-20 22:00+05:30', 3, 3, 150)
$$, 'rides: one-off rides (no usual ride) aren''t limited to one per day');

select throws_ok($$
  insert into rides (owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat) values
    ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b',
     '2026-10-22 08:00+05:30', '2026-10-21 22:00+05:30', 3, 3, 150)
$$, '23503', null, 'rides: the car must belong to the owner');

select throws_ok($$
  update rides set seats_left = 4 where id = '40000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'rides: seats left can''t exceed seats offered');

select throws_ok($$
  update rides set seats_left = -1 where id = '40000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'rides: seats left can''t go below zero');

select throws_ok($$
  update rides set allocation_at = '2026-10-20 09:00+05:30'
   where id = '40000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'rides: allocation happens before departure');

select throws_ok($$
  update rides set status = 'FULL' where id = '40000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'rides: FULL means no seats left');

select throws_ok($$
  update rides set seats_left = 0 where id = '40000000-0000-0000-0000-00000000000a'
$$, '23514', null, 'rides: an OPEN ride has seats left');

select lives_ok($$
  update rides set seats_left = 0, status = 'FULL' where id = '40000000-0000-0000-0000-00000000000a'
$$, 'rides: taking the last seat and marking it FULL together works (lld.md §2)');

select throws_ok($$
  update rides set status = 'DONE' where id = '40000000-0000-0000-0000-00000000000a'
$$, '22P02', null, 'rides: status is one of the documented states');

delete from usual_rides where id = '30000000-0000-0000-0000-00000000000a';
select is(
  (select usual_ride_id from rides where id = '40000000-0000-0000-0000-00000000000a'),
  null,
  'rides: deleting the usual ride keeps its past rides'
);

select throws_ok($$
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000a'
$$, '23503', null, 'rides: an owner with ride history can''t be deleted outright (T-2.4 anonymises)');

-- ride_stops --------------------------------------------------------------------------------- 8

select lives_ok($$
  insert into ride_stops (ride_id, seq, place_id, geo, label, eta_offset_min) values
    ('40000000-0000-0000-0000-00000000000a', 0, '10000000-0000-0000-0000-00000000000a',
     extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
    ('40000000-0000-0000-0000-00000000000a', 1, '10000000-0000-0000-0000-00000000000b',
     extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70)
$$, 'ride_stops: an ordered route is accepted');

select throws_ok($$
  insert into ride_stops (ride_id, seq, geo, label) values
    ('40000000-0000-0000-0000-00000000000a', 1,
     extensions.st_makepoint(77.2, 28.3)::extensions.geography, 'Demo Middle')
$$, '23505', null, 'ride_stops: each position in the route is used once');

select throws_ok($$
  update ride_stops set eta_offset_min = 15
   where ride_id = '40000000-0000-0000-0000-00000000000a' and seq = 0
$$, '23514', null, 'ride_stops: the first stop is the departure (offset 0)');

select throws_ok($$
  update ride_stops set eta_offset_min = 601
   where ride_id = '40000000-0000-0000-0000-00000000000a' and seq = 1
$$, '23514', null, 'ride_stops: a stop is at most 10 hours after departure');

select throws_ok($$
  insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
    ('40000000-0000-0000-0000-00000000000a', 12,
     extensions.st_makepoint(77.2, 28.3)::extensions.geography, 'Demo Far', 90)
$$, '23514', null, 'ride_stops: at most 12 stops');

select throws_ok($$
  insert into ride_stops (ride_id, seq, label, eta_offset_min) values
    ('40000000-0000-0000-0000-00000000000a', 2, 'Demo Nowhere', 80)
$$, '23502', null, 'ride_stops: a stop needs a location');

select throws_ok($$
  insert into ride_stops (ride_id, seq, geo, label) values
    ('40000000-0000-0000-0000-0000000000ff', 0,
     extensions.st_makepoint(77.2, 28.3)::extensions.geography, 'Demo Orphan')
$$, '23503', null, 'ride_stops: belong to a real ride');

delete from places where id = '10000000-0000-0000-0000-00000000000b';
select is(
  (select place_id from ride_stops
    where ride_id = '40000000-0000-0000-0000-00000000000a' and seq = 1),
  null,
  'ride_stops: removing a landmark keeps the stop and its location'
);

select * from finish();
rollback;
