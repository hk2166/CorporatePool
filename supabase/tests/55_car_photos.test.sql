-- Who can see, add and remove car photos in Storage (T-2.3). Same rule as the number plate.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Fixtures (all fake): owner O's car has one photo; R has a confirmed booking on O's ride;
-- S is a stranger.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e0', 'demo.photo.owner@example.com'),
  ('00000000-0000-0000-0000-0000000000e1', 'demo.photo.rider@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'demo.photo.stranger@example.com');
insert into users (id, name) values
  ('00000000-0000-0000-0000-0000000000e0', 'Demo Photo Owner'),
  ('00000000-0000-0000-0000-0000000000e1', 'Demo Photo Rider'),
  ('00000000-0000-0000-0000-0000000000e2', 'Demo Photo Stranger');
insert into cars (id, owner_id, model, colour, plate, seats_total, photo_paths) values
  ('20000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e0',
   'Demo Hatchback', 'White', 'HR26DM0060', 4,
   array['00000000-0000-0000-0000-0000000000e0/front.jpg']);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e0',
   '20000000-0000-0000-0000-0000000000e0',
   '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 2, 150);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
  ('40000000-0000-0000-0000-0000000000e0', 0,
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
  ('40000000-0000-0000-0000-0000000000e0', 1,
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70);
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('40000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-0000000000e1', 0, 1,
   'CONFIRMED', now());
insert into storage.objects (bucket_id, name) values
  ('car-photos', '00000000-0000-0000-0000-0000000000e0/front.jpg');

select is(
  (select public from storage.buckets where id = 'car-photos'),
  false,
  'the car-photos bucket is private (no public URLs)'
);

set local role authenticated;
-- Counts only this file's photo, so other uploads in the local database don't matter.
create temporary view my_photo_count as
  select count(*) as n from storage.objects
   where bucket_id = 'car-photos' and name = '00000000-0000-0000-0000-0000000000e0/front.jpg';

-- Owner
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e0"}', true);
select is((select n from my_photo_count), 1::bigint, 'owner: sees their car''s photo');

-- Confirmed rider
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1"}', true);
select is((select n from my_photo_count), 1::bigint,
  'confirmed rider: sees the photo of the car they''re riding in');

-- Stranger
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2"}', true);
select is((select n from my_photo_count), 0::bigint, 'stranger: can''t see the photo');
select lives_ok($$
  insert into storage.objects (bucket_id, name) values
    ('car-photos', '00000000-0000-0000-0000-0000000000e2/my-car.jpg')
$$, 'stranger: can upload into their own folder');
select throws_ok($$
  insert into storage.objects (bucket_id, name) values
    ('car-photos', '00000000-0000-0000-0000-0000000000e0/fake.jpg')
$$, '42501', null, 'stranger: can''t upload into someone else''s folder');
-- Supabase Storage refuses direct SQL deletes ("use the Storage API"), so deleting is checked
-- through the API instead (see the PR). Here: the delete rule exists and is folder-scoped.
reset role;
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
       and policyname = 'Owners delete their own car photos'
       and qual like '%foldername%auth.uid()%'
  ),
  'deleting is limited to the owner''s own folder'
);

-- The plate function still answers the same way (it now uses the shared check)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1"}', true);
select is(
  (select plate from get_car_private('20000000-0000-0000-0000-0000000000e0')),
  'HR26DM0060',
  'confirmed rider: still sees the plate'
);

-- After the ride, the rider loses access to the photo too
reset role;
update rides set status = 'COMPLETED' where id = '40000000-0000-0000-0000-0000000000e0';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1"}', true);
select is((select n from my_photo_count), 0::bigint,
  'rider: once the ride is completed, the photo is private again');

-- Visitors who aren't signed in
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is(
  (select count(*) from storage.objects where bucket_id = 'car-photos'),
  0::bigint,
  'visitor: sees no car photos at all'
);

select * from finish();
rollback;
