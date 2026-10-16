-- Moderation (T-7.2): remove a member, hide a ride, close reports, all in the audit trail.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Admin A, owner O, riders R1 and R2 (all fake).
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000010' || n)::uuid, 'demo.mod' || n || '@example.com'
  from unnest(array['0a', '0b', '01', '02']) n;
insert into users (id, name, phone, is_admin) values
  ('00000000-0000-0000-0000-00000000100a', 'Demo Admin', '+919999970100', true),
  ('00000000-0000-0000-0000-00000000100b', 'Demo Owner', '+919999970101', false),
  ('00000000-0000-0000-0000-000000001001', 'Demo Rider One', '+919999970102', false),
  ('00000000-0000-0000-0000-000000001002', 'Demo Rider Two', '+919999970103', false);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-00000000100b', '00000000-0000-0000-0000-00000000100b', 'Demo Car', 'White', 'HR26DM100B', 4);
-- Two rides by O, tomorrow at the same stops, first come already: "kept" and "spam".
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat)
select ('30000000-0000-0000-0000-00000000100' || n)::uuid, '00000000-0000-0000-0000-00000000100b',
       '20000000-0000-0000-0000-00000000100b', now() + interval '20 hours', now() - interval '1 hour', 2, 2, 100
  from generate_series(1, 2) n;
insert into ride_stops (ride_id, seq, geo, label)
select ('30000000-0000-0000-0000-00000000100' || n)::uuid, s,
       extensions.st_makepoint(77.33 - s * 0.24, 28.14 + s * 0.35)::extensions.geography, 'Demo Stop ' || s
  from generate_series(1, 2) n, generate_series(0, 1) s;
insert into reports (id, by_user, about_user, ride_id, reason) values
  ('50000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-00000000100b', '30000000-0000-0000-0000-000000001002', 'Demo: this ride is fake'),
  ('50000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000001002',
   '00000000-0000-0000-0000-00000000100b', null, 'Demo: rude on WhatsApp');

-- Hiding a ride ------------------------------------------------------------------------------ 5

select lives_ok($$ select admin_set_ride_hidden('00000000-0000-0000-0000-00000000100a',
  '30000000-0000-0000-0000-000000001002', true, 'Fake ride') $$, 'an admin hides the fake ride');
select is(
  (select array_agg(right(ride_id::text, 1) order by ride_id)
          filter (where ride_id::text like '30000000-0000-0000-0000-00000000100_') from private.match_rides(
     '00000000-0000-0000-0000-000000001001',
     extensions.st_makepoint(77.33, 28.14)::extensions.geography,
     extensions.st_makepoint(77.09, 28.49)::extensions.geography,
     now(), now() + interval '2 days')),
  array['1'], 'it vanishes from search; the other ride is still found');
select throws_ok(
  $$ select request_seat('00000000-0000-0000-0000-000000001001', '30000000-0000-0000-0000-000000001002', 0::smallint, 1::smallint) $$,
  'P0001', 'This ride isn''t taking requests', 'it takes no new requests');
select is((select count(*) from get_public_ride('30000000-0000-0000-0000-000000001002')), 0::bigint,
  'and its WhatsApp card is gone');
select is((select count(*) from rides where id = '30000000-0000-0000-0000-000000001002'), 1::bigint,
  'but the ride itself is still there, for history');

-- Removing a member ---------------------------------------------------------------------------- 6

do $$ begin
  perform request_seat('00000000-0000-0000-0000-000000001001', '30000000-0000-0000-0000-000000001001', 0::smallint, 1::smallint, 1::smallint, true);
end $$;
select lives_ok($$ select admin_remove_user('00000000-0000-0000-0000-00000000100a',
  '00000000-0000-0000-0000-00000000100b', 'Fake rides, reported twice') $$, 'an admin removes the owner');
select ok((select removed_at is not null from users where id = '00000000-0000-0000-0000-00000000100b'),
  'they''re marked removed (the app turns them away and bans their sign-in)');
select is((select status::text from rides where id = '30000000-0000-0000-0000-000000001001'), 'CANCELLED',
  'their ride still to come is cancelled');
select is(
  (select status || ' ' || rematch_requested from bookings where rider_id = '00000000-0000-0000-0000-000000001001'),
  'CANCELLED true', 'and its rider is told and will be found another car');
select throws_ok(
  $$ insert into bookings (ride_id, rider_id, pickup_seq, drop_seq)
     values ('30000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-00000000100b', 0, 1) $$,
  'P0001', 'This ride isn''t taking requests', 'a removed member can''t book anything');
select lives_ok($$ select admin_restore_user('00000000-0000-0000-0000-00000000100a',
  '00000000-0000-0000-0000-00000000100b', 'Cleared up') $$, 'and can be restored');

-- Reports and the audit trail --------------------------------------------------------------- 3

select lives_ok($$ select admin_close_report('00000000-0000-0000-0000-00000000100a',
  '50000000-0000-0000-0000-000000001001', true, 'Ride hidden') $$, 'a report is resolved');
select lives_ok($$ select admin_close_report('00000000-0000-0000-0000-00000000100a',
  '50000000-0000-0000-0000-000000001002', false, 'Not enough to act on') $$, 'another dismissed');
select is(
  (select string_agg(action::text, ', ' order by action::text) from admin_actions
    where admin_id = '00000000-0000-0000-0000-00000000100a'),
  'DISMISS_REPORT, HIDE_RIDE, REMOVE_USER, RESOLVE_REPORT, RESTORE_USER',
  'every action is in the audit trail');

-- Admins only ----------------------------------------------------------------------------------- 2

select throws_ok($$ select admin_remove_user('00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001002', 'Not an admin') $$, '42501', 'Admins only',
  'a member can''t remove anyone');
set local role authenticated;
select throws_ok($$ select admin_set_ride_hidden('00000000-0000-0000-0000-00000000100a',
  '30000000-0000-0000-0000-000000001001', true, 'From the browser') $$, '42501', null,
  'and nobody can call these from the browser, admin or not');

select * from finish();
rollback;
