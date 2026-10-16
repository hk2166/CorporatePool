-- Access rules for bookings, reliability_events, reviews, reports, admin_actions and
-- notifications_outbox (T-1.3, part 3). Each block signs in as one person.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Fixtures, as the database owner (all fake). Owner O's ride has a confirmed booking from R
-- and a request from Q. S is a stranger who has reported O; A is an admin.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b0', 'demo.owner@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'demo.rider@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'demo.requester@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'demo.stranger@example.com'),
  ('00000000-0000-0000-0000-0000000000b4', 'demo.admin@example.com');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-0000000000b0', 'Demo Owner', false),
  ('00000000-0000-0000-0000-0000000000b1', 'Demo Rider', false),
  ('00000000-0000-0000-0000-0000000000b2', 'Demo Requester', false),
  ('00000000-0000-0000-0000-0000000000b3', 'Demo Stranger', false),
  ('00000000-0000-0000-0000-0000000000b4', 'Demo Admin', true);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000b0',
   'Demo Hatchback', 'White', 'HR26DM0050', 4);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000b0',
   '20000000-0000-0000-0000-0000000000b0',
   '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 2, 150);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
  ('40000000-0000-0000-0000-0000000000b0', 0,
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
  ('40000000-0000-0000-0000-0000000000b0', 1,
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70);
insert into bookings (id, ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('50000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-0000000000b0',
   '00000000-0000-0000-0000-0000000000b1', 0, 1, 'CONFIRMED', now());
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
  ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000b2', 0, 1);
insert into reliability_events (user_id, kind, booking_id, points) values
  ('00000000-0000-0000-0000-0000000000b1', 'COMPLETED', '50000000-0000-0000-0000-0000000000b1', 2);
insert into reviews (booking_id, from_user, to_user, stars) values
  ('50000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b0', 5);
insert into reports (by_user, about_user, reason) values
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b0',
   'Asked for extra money at drop-off.');
insert into admin_actions (admin_id, action, target_user, reason) values
  ('00000000-0000-0000-0000-0000000000b4', 'REMOVE_USER', '00000000-0000-0000-0000-0000000000b2',
   'Spam account.');
insert into notifications_outbox (user_id, kind) values
  ('00000000-0000-0000-0000-0000000000b1', 'seat_confirmed');

set local role authenticated;

-- The rider ----------------------------------------------------------------------------------- 9

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b1"}', true);

select is((select count(*) from bookings), 1::bigint, 'rider: sees only their own booking');
select is(
  (select count(*) from bookings where rider_id = '00000000-0000-0000-0000-0000000000b2'),
  0::bigint,
  'rider: can''t see other riders'' bookings'
);
select throws_ok($$
  insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
    ('40000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000b1', 0, 1)
$$, '42501', null, 'rider: can''t create bookings directly (the server handles seats)');
select throws_ok($$
  update bookings set status = 'CANCELLED', decided_at = now()
   where id = '50000000-0000-0000-0000-0000000000b1'
$$, '42501', null, 'rider: can''t change a booking directly');
select is((select count(*) from reliability_events), 1::bigint,
  'rider: sees the events behind their own score');
select throws_ok($$
  insert into reliability_events (user_id, kind, booking_id, points) values
    ('00000000-0000-0000-0000-0000000000b1', 'COMPLETED', '50000000-0000-0000-0000-0000000000b1', 50)
$$, '42501', null, 'rider: can''t award themselves points');
select is((select count(*) from reviews), 1::bigint, 'rider: can read reviews');
select throws_ok($$
  insert into reviews (booking_id, from_user, to_user, stars) values
    ('50000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1',
     '00000000-0000-0000-0000-0000000000b0', 1)
$$, '42501', null, 'rider: reviews go through the server');
select throws_ok($$ select count(*) from notifications_outbox $$, '42501', null,
  'rider: can''t read the notification queue');

-- The owner ----------------------------------------------------------------------------------- 4

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b0"}', true);

select is((select count(*) from bookings), 2::bigint, 'owner: sees every booking on their ride');
select is((select count(*) from reliability_events), 0::bigint,
  'owner: can''t see riders'' reliability events');
select throws_ok($$
  update bookings set status = 'DECLINED', decided_at = now()
   where id = '50000000-0000-0000-0000-0000000000b1'
$$, '42501', null, 'owner: can''t change bookings directly');
select is((select count(*) from reports), 0::bigint, 'owner: can''t see reports about them');

-- The stranger -------------------------------------------------------------------------------- 7

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b3"}', true);

select is((select count(*) from bookings), 0::bigint, 'stranger: sees no bookings');
select lives_ok($$
  insert into reports (by_user, about_user, reason) values
    ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b2',
     'Sent spam links in the group.')
$$, 'stranger: can file a report');
select is((select count(*) from reports), 2::bigint, 'stranger: sees the reports they filed');
select throws_ok($$
  insert into reports (by_user, about_user, reason) values
    ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2',
     'Pretending to be someone else.')
$$, '42501', null, 'stranger: can''t file a report in someone else''s name');
select throws_ok($$
  insert into reports (by_user, about_user, reason, status, resolved_at) values
    ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b2',
     'Already handled, honest.', 'RESOLVED', now())
$$, '42501', null, 'stranger: a new report is always open');
select throws_ok($$
  update reports set status = 'DISMISSED', resolved_at = now()
$$, '42501', null, 'stranger: can''t resolve reports');
select is((select count(*) from admin_actions), 0::bigint, 'stranger: can''t read the audit trail');

-- The admin ----------------------------------------------------------------------------------- 6

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b4"}', true);

select is((select count(*) from bookings), 2::bigint, 'admin: sees all bookings');
select is((select count(*) from reliability_events), 1::bigint, 'admin: sees all reliability events');
select is((select count(*) from reports), 2::bigint, 'admin: sees all reports');
select is((select count(*) from admin_actions), 1::bigint, 'admin: reads the audit trail');
select throws_ok($$
  insert into admin_actions (admin_id, action, target_user, reason) values
    ('00000000-0000-0000-0000-0000000000b4', 'RESTORE_USER', '00000000-0000-0000-0000-0000000000b2',
     'Mistake.')
$$, '42501', null, 'admin: actions are logged by the server, not written directly');
select throws_ok($$ select count(*) from notifications_outbox $$, '42501', null,
  'admin: the notification queue is server-only too');

-- A visitor who isn't signed in ---------------------------------------------------------------- 3

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok($$ select count(*) from bookings $$, '42501', null, 'visitor: can''t read bookings');
select throws_ok($$ select count(*) from reviews $$, '42501', null, 'visitor: can''t read reviews');
select throws_ok($$
  insert into reports (by_user, about_user, reason) values
    ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b0', 'Anonymous report.')
$$, '42501', null, 'visitor: can''t file reports');

select * from finish();
rollback;
