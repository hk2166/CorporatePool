-- Rules on bookings, reliability_events and reviews (T-1.2, part 4).
-- Each rule gets a test that tries to break it. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Tables exist, with Row-Level Security on (deny-all until T-1.3) --------------------------- 6

select has_table('public', t, format('%s exists', t))
  from unnest(array['bookings', 'reliability_events', 'reviews']) as t;

select ok(c.relrowsecurity, format('RLS is on for %s', c.relname))
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('bookings', 'reliability_events', 'reviews')
 order by c.relname;

-- Fixtures: an owner with a car and a 3-stop ride, and three riders (all fake)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d0', 'demo.owner@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'demo.rider1@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'demo.rider2@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'demo.rider3@example.com');
insert into users (id, name) values
  ('00000000-0000-0000-0000-0000000000d0', 'Demo Owner'),
  ('00000000-0000-0000-0000-0000000000d1', 'Demo Rider One'),
  ('00000000-0000-0000-0000-0000000000d2', 'Demo Rider Two'),
  ('00000000-0000-0000-0000-0000000000d3', 'Demo Rider Three');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d0',
   'Demo Hatchback', 'White', 'HR26DM0020', 4);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d0',
   '20000000-0000-0000-0000-0000000000d0',
   '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 3, 150);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
  ('40000000-0000-0000-0000-0000000000d1', 0,
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
  ('40000000-0000-0000-0000-0000000000d1', 1,
   extensions.st_makepoint(77.2000, 28.3000)::extensions.geography, 'Demo Middle', 35),
  ('40000000-0000-0000-0000-0000000000d1', 2,
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70);

-- bookings ---------------------------------------------------------------------------------- 16

select lives_ok($$
  insert into bookings (id, ride_id, rider_id, pickup_seq, drop_seq) values
    ('50000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-0000000000d1',
     '00000000-0000-0000-0000-0000000000d1', 0, 2)
$$, 'bookings: a request from the first stop to the last is accepted');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 1, 2)
$$, '23505', null, 'bookings: one active booking per rider per ride');

update bookings set status = 'CANCELLED', decided_at = now()
 where id = '50000000-0000-0000-0000-0000000000b1';
select lives_ok($$
  insert into bookings (id, ride_id, rider_id, pickup_seq, drop_seq) values
    ('50000000-0000-0000-0000-0000000000b2', '40000000-0000-0000-0000-0000000000d1',
     '00000000-0000-0000-0000-0000000000d1', 1, 2)
$$, 'bookings: after cancelling, the rider can request again');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 1, 1)
$$, '23514', null, 'bookings: pickup and drop are different stops');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 2, 0)
$$, '23514', null, 'bookings: you can''t ride backwards');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 0, 5)
$$, '23503', null, 'bookings: the drop must be a stop of this ride');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, seats) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 0, 2, 0)
$$, '23514', null, 'bookings: at least one seat');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 0, 2,
     'WAITLISTED', now())
$$, '23514', null, 'bookings: a waitlisted booking has a waitlist position');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at,
                        waitlist_rank) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', 0, 2,
     'CONFIRMED', now(), 1)
$$, '23514', null, 'bookings: only waitlisted bookings have a waitlist position');

select lives_ok($$
  insert into bookings (id, ride_id, rider_id, pickup_seq, drop_seq, status, decided_at,
                        waitlist_rank) values
    ('50000000-0000-0000-0000-0000000000b3', '40000000-0000-0000-0000-0000000000d1',
     '00000000-0000-0000-0000-0000000000d2', 0, 2, 'WAITLISTED', now(), 1)
$$, 'bookings: waitlisted at position 1 is accepted');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3', 0, 2,
     'CONFIRMED')
$$, '23514', null, 'bookings: an outcome records when it was decided');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, decided_at) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3', 0, 2, now())
$$, '23514', null, 'bookings: a request still waiting has no decision time');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status) values
    ('40000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3', 0, 2,
     'MAYBE')
$$, '22P02', null, 'bookings: status is one of the documented states');

select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
    ('40000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-0000000000d3', 0, 2)
$$, '23503', null, 'bookings: belong to a real ride');

select throws_ok($$
  delete from rides where id = '40000000-0000-0000-0000-0000000000d1'
$$, '23503', null, 'bookings: a ride with bookings can''t be deleted');

select throws_ok($$
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1'
$$, '23503', null, 'bookings: a rider with bookings can''t be deleted outright (T-2.4 anonymises)');

-- reliability_events ------------------------------------------------------------------------ 10

update bookings set status = 'COMPLETED', decided_at = now()
 where id = '50000000-0000-0000-0000-0000000000b2';

select lives_ok($$
  insert into reliability_events (user_id, kind, booking_id, points) values
    ('00000000-0000-0000-0000-0000000000d1', 'COMPLETED', '50000000-0000-0000-0000-0000000000b2', 2)
$$, 'reliability_events: a completed ride earns points');

select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, points) values
    ('00000000-0000-0000-0000-0000000000d1', 'NO_SHOW', '50000000-0000-0000-0000-0000000000b2', -15)
$$, '23505', null, 'reliability_events: a booking produces at most one event (safe to re-run jobs)');

select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, points) values
    ('00000000-0000-0000-0000-0000000000d2', 'COMPLETED', '50000000-0000-0000-0000-0000000000b3', -2)
$$, '23514', null, 'reliability_events: completing a ride can''t cost points');

select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, points) values
    ('00000000-0000-0000-0000-0000000000d2', 'NO_SHOW', '50000000-0000-0000-0000-0000000000b3', 15)
$$, '23514', null, 'reliability_events: a no-show can''t earn points');

select throws_ok($$
  insert into reliability_events (user_id, kind, points) values
    ('00000000-0000-0000-0000-0000000000d2', 'LATE_CANCEL', -5)
$$, '23514', null, 'reliability_events: a rider''s event comes from a booking');

select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, ride_id, points) values
    ('00000000-0000-0000-0000-0000000000d2', 'LATE_CANCEL', '50000000-0000-0000-0000-0000000000b3',
     '40000000-0000-0000-0000-0000000000d1', -5)
$$, '23514', null, 'reliability_events: a rider''s event points at the booking, not the ride');

select lives_ok($$
  insert into reliability_events (user_id, kind, ride_id, points) values
    ('00000000-0000-0000-0000-0000000000d0', 'OWNER_LATE_CANCEL',
     '40000000-0000-0000-0000-0000000000d1', -5)
$$, 'reliability_events: an owner''s late cancel points at the ride');

select throws_ok($$
  insert into reliability_events (user_id, kind, ride_id, points) values
    ('00000000-0000-0000-0000-0000000000d0', 'OWNER_LATE_CANCEL',
     '40000000-0000-0000-0000-0000000000d1', -5)
$$, '23505', null, 'reliability_events: an owner''s late cancel counts once per ride');

select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, points, resolved_by) values
    ('00000000-0000-0000-0000-0000000000d2', 'NO_SHOW', '50000000-0000-0000-0000-0000000000b3', -15,
     '00000000-0000-0000-0000-0000000000d0')
$$, '23514', null, 'reliability_events: only a disputed event gets resolved');

select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, points) values
    ('00000000-0000-0000-0000-0000000000d2', 'LATE', '50000000-0000-0000-0000-0000000000b3', -5)
$$, '22P02', null, 'reliability_events: kind is one of the documented kinds');

-- reviews ------------------------------------------------------------------------------------ 6

select lives_ok($$
  insert into reviews (booking_id, from_user, to_user, stars, comment) values
    ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1',
     '00000000-0000-0000-0000-0000000000d0', 5, 'On time, AC on.')
$$, 'reviews: a rider can review the owner after the ride');

select throws_ok($$
  insert into reviews (booking_id, from_user, to_user, stars) values
    ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1',
     '00000000-0000-0000-0000-0000000000d0', 4)
$$, '23505', null, 'reviews: each side reviews a booking once');

select throws_ok($$
  insert into reviews (booking_id, from_user, to_user, stars) values
    ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d0',
     '00000000-0000-0000-0000-0000000000d1', 0)
$$, '23514', null, 'reviews: at least 1 star');

select throws_ok($$
  insert into reviews (booking_id, from_user, to_user, stars) values
    ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d0',
     '00000000-0000-0000-0000-0000000000d1', 6)
$$, '23514', null, 'reviews: at most 5 stars');

select throws_ok($$
  insert into reviews (booking_id, from_user, to_user, stars) values
    ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d0',
     '00000000-0000-0000-0000-0000000000d0', 5)
$$, '23514', null, 'reviews: you can''t review yourself');

select throws_ok($$
  insert into reviews (booking_id, from_user, to_user, stars, comment) values
    ('50000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d0',
     '00000000-0000-0000-0000-0000000000d1', 5, repeat('x', 501))
$$, '23514', null, 'reviews: comments are at most 500 characters');

select * from finish();
rollback;
