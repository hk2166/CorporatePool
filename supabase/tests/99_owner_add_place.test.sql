-- Car owners add stops themselves (20261021090000_owners_add_stops.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009b0', 'demo.addstop.owner@example.com'),
  ('00000000-0000-0000-0000-0000000009b1', 'demo.addstop.rider@example.com');
insert into users (id, name, ride_preference) values
  ('00000000-0000-0000-0000-0000000009b0', 'Demo Stop Owner', 'DRIVER'),
  ('00000000-0000-0000-0000-0000000009b1', 'Demo Stop Rider', 'RIDER');
-- A stop to measure from, so the "far from every stop" rule has something to go by.
insert into places (name, geo) values
  ('Demo Anchor Stop', extensions.st_makepoint(77.2000, 28.3000)::extensions.geography);

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id)::text, true)
$$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000009b0');

-- A new stop, straight into the list ------------------------------------------------------- 3
select is(
  (select created from owner_add_place('Demo New Corner', 28.3100, 77.2100)), true,
  'an owner adds a new stop');
select is(
  (select count(*) from places where name = 'Demo New Corner' and created_by = '00000000-0000-0000-0000-0000000009b0'),
  1::bigint, 'it is in the list, marked as theirs');
select is(
  (select round(lat::numeric, 4) || ',' || round(lng::numeric, 4) from owner_add_place('demo new corner', 28.3100, 77.2100)),
  '28.3100,77.2100', 'the same name again (any case) gives that stop back, with where it is');

-- No duplicates ------------------------------------------------------------------------------- 2
select is(
  (select place_name || ' ' || created from owner_add_place('Demo Other Name', 28.3105, 77.2100)),
  'Demo New Corner false', 'a point within 150 m of a stop gives that stop instead of a new one');
select is((select count(*) from places where name = 'Demo Other Name'), 0::bigint, 'nothing new is added');

-- What's refused ------------------------------------------------------------------------------ 5
select throws_ok($$ select owner_add_place('X', 28.32, 77.22) $$, '22023', null, 'a one-letter name');
select throws_ok($$ select owner_add_place('Demo Nowhere', null, 77.22) $$, '22023', null, 'no position');
select throws_ok($$ select owner_add_place('Demo Far Away', 19.0760, 72.8777) $$, '22023', null,
  'a point 60 km or more from every stop (a wrong link)');
-- Ten a day: nine more after the first.
select owner_add_place('Demo Daily ' || i, 28.32 + i * 0.01, 77.22) from generate_series(1, 9) i;
select throws_ok($$ select owner_add_place('Demo One Too Many', 28.45, 77.22) $$, '22023', null,
  'at most 10 new stops a day');

select pg_temp.as_user('00000000-0000-0000-0000-0000000009b1');
select throws_ok($$ select owner_add_place('Demo Rider Corner', 28.33, 77.23) $$, '42501', null,
  'members who don''t drive ask an admin instead');

-- Visitors ----------------------------------------------------------------------------------- 2
reset role;
set local role anon;
select throws_ok($$ select owner_add_place('Demo Anon Corner', 28.33, 77.23) $$, '42501', null,
  'visitors can''t add stops');
reset role;
select is((select count(*) from places where name like 'Demo % Corner' and name <> 'Demo New Corner'), 0::bigint,
  'none of the refused stops were added');

select * from finish();
rollback;
