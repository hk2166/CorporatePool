-- Access rules for places, cars, usual_rides, rides and ride_stops (T-1.3, part 1).
-- Each block signs in as one person and checks what they can and can't do.
-- Signing in = role `authenticated` plus the user id in request.jwt.claims, which is what
-- auth.uid() reads. `anon` is a visitor who isn't signed in.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Fixtures, created as the database owner (all fake people, per task.md T-1.4) -------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f0', 'demo.owner@example.com'),
  ('00000000-0000-0000-0000-0000000000f1', 'demo.rider@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'demo.stranger@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'demo.admin@example.com');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-0000000000f0', 'Demo Owner', false),
  ('00000000-0000-0000-0000-0000000000f1', 'Demo Rider', false),
  ('00000000-0000-0000-0000-0000000000f2', 'Demo Stranger', false),
  ('00000000-0000-0000-0000-0000000000f3', 'Demo Admin', true);
insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-0000000000f1', 'Demo Start',
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography),
  ('10000000-0000-0000-0000-0000000000f2', 'Demo End',
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography);
insert into cars (id, owner_id, model, colour, plate, seats_total, photo_paths) values
  ('20000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000f0',
   'Demo Hatchback', 'White', 'HR26DM0030', 4, array['cars/demo-owner.jpg']),
  ('20000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2',
   'Demo Sedan', 'Grey', 'HR26DM0031', 4, '{}');
insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops) values
  ('00000000-0000-0000-0000-0000000000f0', '20000000-0000-0000-0000-0000000000f0', '08:00', 3, 150,
   '[{"label": "Demo Start"}, {"label": "Demo End"}]');
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000f0',
   '20000000-0000-0000-0000-0000000000f0',
   '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 2, 150);
insert into ride_stops (ride_id, seq, place_id, geo, label, eta_offset_min) values
  ('40000000-0000-0000-0000-0000000000f0', 0, '10000000-0000-0000-0000-0000000000f1',
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
  ('40000000-0000-0000-0000-0000000000f0', 1, '10000000-0000-0000-0000-0000000000f2',
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70);
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('40000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000f1', 0, 1,
   'CONFIRMED', now());

-- A stranger: signed in, no booking on this ride ------------------------------------------ 14

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2"}', true);

select is((select count(*) from places), 2::bigint, 'stranger: can read the stop list');
select throws_ok($$
  insert into places (name, geo) values
    ('Demo Fake', extensions.st_makepoint(77.1, 28.2)::extensions.geography)
$$, '42501', null, 'stranger: can''t add stops');
select is((select count(*) from rides), 1::bigint, 'stranger: can see rides (search)');
select is((select count(*) from ride_stops), 2::bigint, 'stranger: can see ride routes');
select throws_ok($$
  insert into rides (owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat) values
    ('00000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f2',
     '2026-10-21 08:00+05:30', '2026-10-20 22:00+05:30', 3, 3, 150)
$$, '42501', null, 'stranger: can''t create rides directly (the server does going live)');
select throws_ok($$
  update rides set seats_left = 0 where id = '40000000-0000-0000-0000-0000000000f0'
$$, '42501', null, 'stranger: can''t change seat counts');
select is(
  (select model from cars where id = '20000000-0000-0000-0000-0000000000f0'),
  'Demo Hatchback',
  'stranger: can see a car''s model'
);
select throws_ok($$
  select plate from cars where id = '20000000-0000-0000-0000-0000000000f0'
$$, '42501', null, 'stranger: can''t read number plates');
select is(
  (select count(*) from get_car_private('20000000-0000-0000-0000-0000000000f0')),
  0::bigint,
  'stranger: gets nothing from get_car_private (no confirmed booking)'
);
select is((select count(*) from usual_rides), 0::bigint, 'stranger: can''t see others'' usual rides');
select throws_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-0000000000f0', 'Demo Fake', 'Red', 'HR26DM0039', 4)
$$, '42501', null, 'stranger: can''t add a car in someone else''s name');
select lives_ok($$
  insert into cars (owner_id, model, colour, plate, seats_total) values
    ('00000000-0000-0000-0000-0000000000f2', 'Demo Coupe', 'Blue', 'HR26DM0032', 2)
$$, 'stranger: can add their own car');
select lives_ok($$
  update cars set colour = 'Red' where id = '20000000-0000-0000-0000-0000000000f0'
$$, 'stranger: editing someone else''s car silently changes nothing…');
select is(
  (select colour from cars where id = '20000000-0000-0000-0000-0000000000f0'),
  'White',
  '…the colour is still White'
);

-- The rider with a confirmed booking on the ride ------------------------------------------- 2

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f1"}', true);

select is(
  (select plate from get_car_private('20000000-0000-0000-0000-0000000000f0')),
  'HR26DM0030',
  'confirmed rider: sees the plate of the car they''re riding in'
);
select is(
  (select count(*) from get_car_private('20000000-0000-0000-0000-0000000000f2')),
  0::bigint,
  'confirmed rider: still can''t see other cars'' plates'
);

-- The owner ------------------------------------------------------------------------------- 3

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f0"}', true);

select is(
  (select plate from get_car_private('20000000-0000-0000-0000-0000000000f0')),
  'HR26DM0030',
  'owner: sees their own plate'
);
select is((select count(*) from usual_rides), 1::bigint, 'owner: sees their own usual ride');
select lives_ok($$
  update cars set colour = 'Silver' where id = '20000000-0000-0000-0000-0000000000f0'
$$, 'owner: can edit their own car');

-- An admin --------------------------------------------------------------------------------- 2

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3"}', true);

select lives_ok($$
  insert into places (name, geo) values
    ('Demo Admin Stop', extensions.st_makepoint(77.2, 28.3)::extensions.geography)
$$, 'admin: can add stops');
select is(
  (select count(*) from get_car_private('20000000-0000-0000-0000-0000000000f2')),
  1::bigint,
  'admin: can see any car''s plate'
);

-- Back to the stranger: deleting a stop silently does nothing ------------------------------ 1

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2"}', true);
delete from places;
select is((select count(*) from places), 3::bigint, 'stranger: deleting stops removes nothing');

-- A visitor who isn't signed in ------------------------------------------------------------ 6

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok($$ select count(*) from rides $$, '42501', null, 'visitor: can''t read rides');
select throws_ok($$ select count(*) from places $$, '42501', null, 'visitor: can''t read places');
select is(
  (select owner_first_name from get_public_ride('40000000-0000-0000-0000-0000000000f0')),
  'Demo',
  'visitor: the public ride card shows only the owner''s first name'
);
select is(
  (select stops -> 1 from get_public_ride('40000000-0000-0000-0000-0000000000f0')),
  '{"seq": 1, "label": "Demo End", "eta_offset_min": 70}'::jsonb,
  'visitor: the card''s route has labels and times only, no locations or ids'
);
select is(
  (select count(*) from get_public_ride('40000000-0000-0000-0000-0000000000ff')),
  0::bigint,
  'visitor: an unknown ride gives an empty card'
);
select throws_ok($$
  select * from get_car_private('20000000-0000-0000-0000-0000000000f0')
$$, '42501', null, 'visitor: can''t call get_car_private');

-- After the ride is over, the rider no longer sees the plate ------------------------------- 1

reset role;
update rides set status = 'COMPLETED' where id = '40000000-0000-0000-0000-0000000000f0';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f1"}', true);

select is(
  (select count(*) from get_car_private('20000000-0000-0000-0000-0000000000f0')),
  0::bigint,
  'rider: once the ride is completed, the plate is private again'
);

select * from finish();
rollback;
