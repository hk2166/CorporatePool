-- Rules on places, users, cars, signup_tokens and blocks (T-1.2, part 2).
-- Each rule gets a test that tries to break it. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Tables exist, with Row-Level Security on (deny-all until T-1.3) -------------------------- 10

select has_table('public', t, format('%s exists', t))
  from unnest(array['places', 'users', 'cars', 'signup_tokens', 'blocks']) as t;

select ok(c.relrowsecurity, format('RLS is on for %s', c.relname))
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('places', 'users', 'cars', 'signup_tokens', 'blocks')
 order by c.relname;

-- Fixtures: three fake auth users (task.md T-1.4 rules: Demo names, example.com emails)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'demo.rider@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'demo.owner@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'demo.third@example.com');

-- places ------------------------------------------------------------------------------------ 6

select lives_ok($$
  insert into places (id, name, geo, kind) values
    ('10000000-0000-0000-0000-000000000001', 'Demo Stop A',
     extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'landmark'),
    ('10000000-0000-0000-0000-000000000002', 'Demo Stop B',
     extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'office')
$$, 'places: valid stops are accepted');

select throws_ok($$
  insert into places (name, geo) values
    ('Demo Stop A', extensions.st_makepoint(77.1, 28.2)::extensions.geography)
$$, '23505', null, 'places: names are unique');

select throws_ok($$
  insert into places (name, geo) values
    (' Demo Stop C', extensions.st_makepoint(77.1, 28.2)::extensions.geography)
$$, '23514', null, 'places: names have no leading or trailing spaces');

select throws_ok($$
  insert into places (name, geo, kind) values
    ('Demo Stop D', extensions.st_makepoint(77.1, 28.2)::extensions.geography, 'airport')
$$, '22P02', null, 'places: kind must be landmark, metro, office or town');

select throws_ok($$
  insert into places (name, geo, use_count) values
    ('Demo Stop E', extensions.st_makepoint(77.1, 28.2)::extensions.geography, -1)
$$, '23514', null, 'places: use_count can''t be negative');

select throws_ok($$
  insert into places (name) values ('Demo Stop F')
$$, '23502', null, 'places: a stop needs a location');

-- users ------------------------------------------------------------------------------------ 11

select lives_ok($$
  insert into users (id, name, phone, upi_vpa, home_place_id, work_place_id) values
    ('00000000-0000-0000-0000-000000000001', 'Demo Rider', '+910000000001', null,
     '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000002', 'Demo Owner', '+910000000002', 'demo.owner@okdemo',
     null, null),
    ('00000000-0000-0000-0000-000000000003', 'Demo Third', null, null, null, null)
$$, 'users: valid profiles are accepted, phone can be empty at first');

select is(
  (select reliability_score from users where id = '00000000-0000-0000-0000-000000000003'),
  50::smallint,
  'users: everyone starts with a reliability score of 50'
);

select throws_ok($$
  update users set phone = '9876543210' where id = '00000000-0000-0000-0000-000000000003'
$$, '23514', null, 'users: phone must be in +<country code><number> form');

select throws_ok($$
  update users set phone = '+910000000001' where id = '00000000-0000-0000-0000-000000000003'
$$, '23505', null, 'users: two people can''t share a phone number');

select throws_ok($$
  update users set gender = 'unknown' where id = '00000000-0000-0000-0000-000000000003'
$$, '23514', null, 'users: gender is female, male or other');

select throws_ok($$
  update users set upi_vpa = 'not-a-upi-id' where id = '00000000-0000-0000-0000-000000000003'
$$, '23514', null, 'users: UPI ID must look like name@bank');

select throws_ok($$
  update users set reliability_score = 101 where id = '00000000-0000-0000-0000-000000000003'
$$, '23514', null, 'users: reliability score stays within 0–100');

select throws_ok($$
  update users set rides_completed = -1 where id = '00000000-0000-0000-0000-000000000003'
$$, '23514', null, 'users: counters can''t be negative');

select throws_ok($$
  insert into users (id, name) values ('00000000-0000-0000-0000-0000000000ff', 'Demo Nobody')
$$, '23503', null, 'users: every profile belongs to a Supabase Auth user');

select throws_ok($$
  update users set home_place_id = '10000000-0000-0000-0000-0000000000ff'
   where id = '00000000-0000-0000-0000-000000000003'
$$, '23503', null, 'users: home stop must be a real place');

delete from places where id = '10000000-0000-0000-0000-000000000002';
select is(
  (select work_place_id from users where id = '00000000-0000-0000-0000-000000000001'),
  null,
  'users: removing a place clears it from profiles instead of failing'
);

-- cars --------------------------------------------------------------------------------------- 8

select lives_ok($$
  insert into cars (id, owner_id, model, colour, plate, seats_total, photo_paths) values
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
     'Demo Hatchback', 'White', 'HR26DM0001', 4, array['cars/demo-1.jpg'])
$$, 'cars: a valid car is accepted');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-000000000002', 'Demo Sedan', 'Grey', 'hr26dm0002', 4)
$$, '23514', null, 'cars: plate is stored in upper case');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-000000000002', 'Demo Sedan', 'Grey', 'HR 26 DM 0002', 4)
$$, '23514', null, 'cars: plate is stored without spaces');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-000000000001', 'Demo Sedan', 'Grey', 'HR26DM0001', 4)
$$, '23505', null, 'cars: the same plate can''t be registered twice');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-000000000002', 'Demo Sedan', 'Grey', 'HR26DM0003', 0)
$$, '23514', null, 'cars: at least 1 seat');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-000000000002', 'Demo Sedan', 'Grey', 'HR26DM0004', 8)
$$, '23514', null, 'cars: at most 7 seats');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total, photo_paths) values
    ('00000000-0000-0000-0000-000000000002', 'Demo Sedan', 'Grey', 'HR26DM0005', 4,
     array['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg'])
$$, '23514', null, 'cars: at most 6 photos');

select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-0000000000ff', 'Demo Sedan', 'Grey', 'HR26DM0006', 4)
$$, '23503', null, 'cars: owner must be a user');

-- signup_tokens ------------------------------------------------------------------------------ 5

select lives_ok($$
  insert into signup_tokens (token, created_by, max_uses, expires_at) values
    ('demo-token-aaaaaaaaaaaaaaaa', '00000000-0000-0000-0000-000000000003', 5,
     now() + interval '7 days')
$$, 'signup_tokens: a valid invite is accepted');

select throws_ok($$
  insert into signup_tokens (token, created_by, expires_at) values
    ('short', '00000000-0000-0000-0000-000000000003', now() + interval '7 days')
$$, '23514', null, 'signup_tokens: tokens are long enough not to be guessed');

select throws_ok($$
  update signup_tokens set used_count = 6 where token = 'demo-token-aaaaaaaaaaaaaaaa'
$$, '23514', null, 'signup_tokens: can''t be used more times than allowed');

select throws_ok($$
  insert into signup_tokens (token, created_by, max_uses, expires_at) values
    ('demo-token-bbbbbbbbbbbbbbbb', '00000000-0000-0000-0000-000000000003', 0,
     now() + interval '7 days')
$$, '23514', null, 'signup_tokens: at least one use');

select throws_ok($$
  insert into signup_tokens (token, created_by, expires_at) values
    ('demo-token-cccccccccccccccc', '00000000-0000-0000-0000-000000000003',
     now() - interval '1 day')
$$, '23514', null, 'signup_tokens: expiry is after creation');

-- blocks ------------------------------------------------------------------------------------- 3

select lives_ok($$
  insert into blocks (blocker_id, blocked_id) values
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
$$, 'blocks: a person can block another');

select throws_ok($$
  insert into blocks (blocker_id, blocked_id) values
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
$$, '23514', null, 'blocks: you can''t block yourself');

select throws_ok($$
  insert into blocks (blocker_id, blocked_id) values
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')
$$, '23505', null, 'blocks: the same block only once');

-- Deleting an account with no ride history removes what belongs to it ----------------------- 3

delete from auth.users where id = '00000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from users where id = '00000000-0000-0000-0000-000000000002'),
  0::bigint,
  'deleting the auth user deletes the profile'
);
select is(
  (select count(*) from cars where owner_id = '00000000-0000-0000-0000-000000000002'),
  0::bigint,
  '…and the person''s cars'
);
select is(
  (select count(*) from blocks where blocked_id = '00000000-0000-0000-0000-000000000002'),
  0::bigint,
  '…and blocks involving them'
);

select * from finish();
rollback;
