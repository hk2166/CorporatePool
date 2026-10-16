-- The stop list (T-7.3): add, rename, merge.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001101', 'demo.places.admin@example.com'),
  ('00000000-0000-0000-0000-000000001102', 'demo.places.member@example.com');
insert into users (id, name, phone, is_admin) values
  ('00000000-0000-0000-0000-000000001101', 'Demo Places Admin', '+919999980101', true),
  ('00000000-0000-0000-0000-000000001102', 'Demo Places Member', '+919999980102', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001101"}', true);

-- Adding and changing -------------------------------------------------------------------------- 3

create temporary table ids on commit drop as
select admin_save_place(null, 'Demo Merge Bus Stand', 'landmark', 28.144, 77.329) as keep,
       admin_save_place(null, 'Demo merge bus stand ', 'landmark', 28.1441, 77.3291) as dupe;
grant select on ids to authenticated;
select is((select count(*) from places where id in ((select keep from ids), (select dupe from ids))),
  2::bigint, 'an admin adds stops');
select is((select name from places where id = (select dupe from ids)), 'Demo merge bus stand',
  'names are trimmed');
select lives_ok($$ select admin_save_place((select keep from ids), 'Demo Merge Bus Stand', 'town', 28.144, 77.329) $$,
  'and changes them');

-- Things that point at the duplicate: a member's home stop, a usual ride, a ride to come, a
-- ride that already happened.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000001103', 'demo.merge.home@example.com');
insert into users (id, name, phone, home_place_id)
select '00000000-0000-0000-0000-000000001103', 'Demo Merge Home', '+919999980103', dupe from ids;
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001102', 'Demo Car', 'White', 'HR26DM1102', 4);
insert into usual_rides (id, owner_id, car_id, depart_time, seats_offered, price_per_seat, stops)
select '30000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001102',
       '20000000-0000-0000-0000-000000001102', '08:00', 3, 100,
       jsonb_build_array(
         jsonb_build_object('place_id', dupe, 'label', 'Demo merge bus stand', 'lat', 28.1441, 'lng', 77.3291, 'eta_offset_min', 0),
         jsonb_build_object('label', 'Demo Office Pin', 'lat', 28.49, 'lng', 77.09, 'eta_offset_min', 70))
  from ids;
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat, status)
values
  ('40000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001102', '20000000-0000-0000-0000-000000001102',
   now() + interval '1 day', now(), 3, 3, 100, 'OPEN'),
  ('40000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001102', '20000000-0000-0000-0000-000000001102',
   now() - interval '1 day', now() - interval '2 days', 3, 3, 100, 'COMPLETED');
insert into ride_stops (ride_id, seq, place_id, geo, label, eta_offset_min)
select r, 0, dupe, extensions.st_makepoint(77.3291, 28.1441)::extensions.geography, 'Demo merge bus stand', 0
  from ids, unnest(array['40000000-0000-0000-0000-000000001101', '40000000-0000-0000-0000-000000001102']::uuid[]) r;

-- Merging --------------------------------------------------------------------------------------- 6

set local role authenticated;
select is(admin_merge_places((select dupe from ids), (select keep from ids)), 4,
  'merging moves the 4 references');
reset role;
select is((select home_place_id from users where id = '00000000-0000-0000-0000-000000001103'),
  (select keep from ids), 'a member''s home stop now points at the kept stop');
select is(
  (select stops -> 0 ->> 'place_id' || ' ' || (stops -> 0 ->> 'label') from usual_rides where id = '30000000-0000-0000-0000-000000001101'),
  (select keep from ids)::text || ' Demo Merge Bus Stand', 'so does the usual ride, with the kept name');
select is(
  (select label from ride_stops where ride_id = '40000000-0000-0000-0000-000000001101'),
  'Demo Merge Bus Stand', 'a ride still to come takes the kept name');
select is(
  (select place_id = (select keep from ids) and label = 'Demo merge bus stand'
     from ride_stops where ride_id = '40000000-0000-0000-0000-000000001102'),
  true, 'a ride that already happened points at the kept stop but keeps its old name');
select is((select count(*) from places where id = (select dupe from ids)), 0::bigint,
  'and the duplicate is gone');

-- Admins only ----------------------------------------------------------------------------------- 2

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001102"}', true);
select throws_ok($$ select admin_save_place(null, 'Demo Sneaky Stop', 'landmark', 28.1, 77.3) $$,
  '42501', 'Admins only', 'a member can''t add stops');
select throws_ok($$ select admin_merge_places((select keep from ids), (select keep from ids)) $$,
  '42501', 'Admins only', 'or merge them');

select * from finish();
rollback;
