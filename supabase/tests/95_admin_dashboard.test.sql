-- The admin dashboard (daily activity, summary, daily stats, top trips, members).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Admin A, member M (with home and work stops, a car and a usual ride), rider R.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001301', 'demo.dash.admin@example.com'),
  ('00000000-0000-0000-0000-000000001302', 'demo.dash.member@example.com'),
  ('00000000-0000-0000-0000-000000001303', 'demo.dash.rider@example.com');
insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-000000001301', 'Demo Dash Home', extensions.st_makepoint(77.30, 28.10)::extensions.geography),
  ('10000000-0000-0000-0000-000000001302', 'Demo Dash Office', extensions.st_makepoint(77.10, 28.50)::extensions.geography);
insert into users (id, name, phone, is_admin, home_place_id, work_place_id, created_at) values
  ('00000000-0000-0000-0000-000000001301', 'Demo Dash Admin', '+919999981301', true, null, null, now()),
  ('00000000-0000-0000-0000-000000001302', 'Demo Dash Member', '+919999981302', false,
   '10000000-0000-0000-0000-000000001301', '10000000-0000-0000-0000-000000001302', now()),
  ('00000000-0000-0000-0000-000000001303', 'Demo Dash Rider', '+919999981303', false, null, null,
   (date '2020-02-10' + time '09:00') at time zone 'Asia/Kolkata');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000001302', '00000000-0000-0000-0000-000000001302', 'Demo Sedan', 'Blue', 'HR26DM1302', 4);
insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, auto_golive_days, stops)
values ('00000000-0000-0000-0000-000000001302', '20000000-0000-0000-0000-000000001302', '08:15', 3, 100, 31,
        '[{"label": "Demo Dash Home", "lat": 28.10, "lng": 77.30, "eta_offset_min": 0},
          {"label": "Demo Dash Office", "lat": 28.50, "lng": 77.10, "eta_offset_min": 60}]');

-- A day in the past (D = 10 Feb 2020): M's ride with 3 seats; R rode with 2 seats, asked that
-- day. Activity: M and R were both in the app.
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat, status)
values ('30000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001302', '20000000-0000-0000-0000-000000001302',
        (date '2020-02-10' + time '08:15') at time zone 'Asia/Kolkata',
        (date '2020-02-09' + time '22:00') at time zone 'Asia/Kolkata', 3, 1, 100, 'COMPLETED');
insert into ride_stops (ride_id, seq, geo, label) values
  ('30000000-0000-0000-0000-000000001301', 0, extensions.st_makepoint(77.30, 28.10)::extensions.geography, 'Demo Dash Home'),
  ('30000000-0000-0000-0000-000000001301', 1, extensions.st_makepoint(77.10, 28.50)::extensions.geography, 'Demo Dash Office');
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, seats, status, decided_at, created_at)
values ('30000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001303', 0, 1, 2, 'COMPLETED', now(),
        (date '2020-02-10' + time '06:00') at time zone 'Asia/Kolkata');
insert into member_activity (user_id, day) values
  ('00000000-0000-0000-0000-000000001302', '2020-02-10'),
  ('00000000-0000-0000-0000-000000001303', '2020-02-10');

set local role authenticated;

-- Recording visits --------------------------------------------------------------------------- 2

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001302"}', true);
select record_visit();
select record_visit();
reset role;
select is(
  (select count(*) from member_activity where user_id = '00000000-0000-0000-0000-000000001302'
     and day = (now() at time zone 'Asia/Kolkata')::date),
  1::bigint, 'opening the app twice in a day counts once');
update users set removed_at = now() where id = '00000000-0000-0000-0000-000000001303';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001303"}', true);
select record_visit();
reset role;
select is(
  (select count(*) from member_activity where user_id = '00000000-0000-0000-0000-000000001303'
     and day = (now() at time zone 'Asia/Kolkata')::date),
  0::bigint, 'a removed member isn''t counted');
update users set removed_at = null where id = '00000000-0000-0000-0000-000000001303';
set local role authenticated;

-- As the admin ----------------------------------------------------------------------------------- 10

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001301"}', true);

select results_eq(
  $$ select active_members, new_members, rides, seats_offered, seats_filled, requests
       from admin_daily_stats('2020-02-10', '2020-02-10') $$,
  $$ values (2, 1, 1, 3, 2, 1) $$,
  'a day: 2 active, 1 joined, 1 ride with 3 seats, 2 filled, 1 request');
select is((select count(*) from admin_daily_stats('2020-02-09', '2020-02-11')), 3::bigint,
  'every day in the range has a row, quiet days too');
select results_eq(
  $$ select pickup, dropoff, trips, riders from admin_top_trips('2020-02-10', '2020-02-10') $$,
  $$ values ('Demo Dash Home', 'Demo Dash Office', 1, 1) $$,
  'where people went that day');

-- (The admin functions read past the access rules; compare against the tables as the owner.)
reset role;
select is((select members from admin_summary()),
  (select count(*)::integer from users where removed_at is null),
  'the summary''s member count matches the table');
select is((select active_today from admin_summary()),
  (select count(*)::integer from member_activity where day = (now() at time zone 'Asia/Kolkata')::date),
  'and active today matches the activity log');
set local role authenticated;

select results_eq(
  $$ select email, home, work, rides_offered, rides_taken, last_active = (now() at time zone 'Asia/Kolkata')::date
       from admin_members() where user_id = '00000000-0000-0000-0000-000000001302' $$,
  $$ values ('demo.dash.member@example.com'::text, 'Demo Dash Home'::text, 'Demo Dash Office'::text, 1, 0, true) $$,
  'a member in the list: email, usual commute, rides, last active');
select is((select count(*) from admin_members('dash.rider')), 1::bigint, 'searching by email finds them');
select is((select rides_taken from admin_members('Demo Dash Rider')), 1, 'the rider took one ride');

select results_eq(
  $$ select car, plate, usual_route, usual_time, usual_days from admin_member('00000000-0000-0000-0000-000000001302') $$,
  $$ values ('Blue Demo Sedan · 4 seats'::text, 'HR26DM1302'::text, 'Demo Dash Home → Demo Dash Office'::text,
             time '08:15', 31::smallint) $$,
  'one member in full: car, plate and usual ride');
select is((select active_days_30 from admin_member('00000000-0000-0000-0000-000000001303')), 0,
  'activity years ago doesn''t count in the last 30 days');

-- Admins only ----------------------------------------------------------------------------------- 2

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001302"}', true);
select throws_ok($$ select * from admin_members() $$, '42501', 'Admins only', 'a member can''t list members');
select throws_ok($$ select * from admin_daily_stats(current_date, current_date) $$, '42501', 'Admins only',
  'or see the daily numbers');

select * from finish();
rollback;
