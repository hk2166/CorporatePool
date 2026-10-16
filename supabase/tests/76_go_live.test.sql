-- go_live() (T-3.2): one tap turns the usual ride into a ride for a day.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Fixtures (all fake): owner O with a phone, a 4-seat car and a usual ride; P has no phone.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'demo.golive@example.com'),
  ('00000000-0000-0000-0000-0000000000a8', 'demo.golive.nophone@example.com');
insert into users (id, name, phone) values
  ('00000000-0000-0000-0000-0000000000a7', 'Demo Go Live', '+919999930001'),
  ('00000000-0000-0000-0000-0000000000a8', 'Demo No Phone', null);
insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-0000000000a7', 'Demo Go Live Start',
   extensions.st_makepoint(77.3290, 28.1440)::extensions.geography);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7',
   'Demo Hatchback', 'White', 'HR26DM0080', 4),
  ('20000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a8',
   'Demo Sedan', 'Grey', 'HR26DM0081', 4);
insert into usual_rides (id, owner_id, car_id, depart_time, seats_offered, price_per_seat,
                         notes, stops) values
  ('30000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a7',
   '20000000-0000-0000-0000-0000000000a7', '08:00', 3, 110, 'AC on',
   jsonb_build_array(
     jsonb_build_object('place_id', '10000000-0000-0000-0000-0000000000a7',
                        'label', 'Demo Go Live Start', 'lat', 28.1440, 'lng', 77.3290,
                        'eta_offset_min', 0),
     jsonb_build_object('place_id', '10000000-0000-0000-0000-0000000000ff',
                        'label', 'Demo Deleted Landmark', 'lat', 28.3200, 'lng', 77.2000,
                        'eta_offset_min', 35),
     jsonb_build_object('label', 'Demo Office Pin', 'lat', 28.4955, 'lng', 77.0886,
                        'eta_offset_min', 70))),
  ('30000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a8',
   '20000000-0000-0000-0000-0000000000a8', '08:00', 3, 110, null,
   '[{"label": "a", "lat": 28.1, "lng": 77.3, "eta_offset_min": 0},
     {"label": "b", "lat": 28.5, "lng": 77.1, "eta_offset_min": 60}]');

-- The day after tomorrow in India, so the test works whatever day it runs.
create temporary table d on commit drop as
select ((now() at time zone 'Asia/Kolkata')::date + 2) as day;

-- Going live ------------------------------------------------------------------------------- 8

create temporary table first_tap on commit drop as
select * from go_live('00000000-0000-0000-0000-0000000000a7',
                      '30000000-0000-0000-0000-0000000000a7', (select day from d));

select ok((select created from first_tap), 'the first tap creates a ride');
select is(
  (select (depart_at at time zone 'Asia/Kolkata')::text from rides
    where id = (select ride_id from first_tap)),
  ((select day from d) + time '08:00')::text,
  'it sets off at the usual time, 08:00 in India'
);
select is(
  (select (allocation_at at time zone 'Asia/Kolkata')::text from rides
    where id = (select ride_id from first_tap)),
  (((select day from d) - 1) + time '22:00')::text,
  'seats are allocated at 22:00 the evening before (Q6)'
);
select is(
  (select seats_total || '/' || seats_left || ' seats, ₹' || price_per_seat || ', ' || notes || ', ' || status
     from rides where id = (select ride_id from first_tap)),
  '3/3 seats, ₹110, AC on, OPEN',
  'seats, price and notes come from the usual ride, and it''s open'
);
select is(
  (select array_agg(label || ' +' || eta_offset_min order by seq) from ride_stops
    where ride_id = (select ride_id from first_tap)),
  array['Demo Go Live Start +0', 'Demo Deleted Landmark +35', 'Demo Office Pin +70'],
  'the stops are copied in order with their times'
);
select is(
  (select array_agg(place_id is not null order by seq) from ride_stops
    where ride_id = (select ride_id from first_tap)),
  array[true, false, false],
  'stops keep their landmark link only if the landmark still exists'
);
select ok(
  (select extensions.st_dwithin(geo, extensions.st_makepoint(77.0886, 28.4955)::extensions.geography, 1)
     from ride_stops where ride_id = (select ride_id from first_tap) and seq = 2),
  'each stop is at the saved location'
);

create temporary table second_tap on commit drop as
select * from go_live('00000000-0000-0000-0000-0000000000a7',
                      '30000000-0000-0000-0000-0000000000a7', (select day from d),
                      '07:30', 2::smallint);
select ok(
  (select not created and ride_id = (select ride_id from first_tap) from second_tap),
  'tapping again the same day returns the same ride instead of a second one'
);

-- A different day, with changes for that day only ------------------------------------------- 2

create temporary table other_day on commit drop as
select * from go_live('00000000-0000-0000-0000-0000000000a7',
                      '30000000-0000-0000-0000-0000000000a7', (select day + 1 from d),
                      '07:30', 2::smallint);
select is(
  (select to_char(depart_at at time zone 'Asia/Kolkata', 'HH24:MI') || ', ' || seats_left || ' seats'
     from rides where id = (select ride_id from other_day)),
  '07:30, 2 seats',
  'the time and seats can be changed for one day'
);
select is(
  (select depart_time::text || ', ' || seats_offered from usual_rides
    where id = '30000000-0000-0000-0000-0000000000a7'),
  '08:00:00, 3',
  '…without changing the usual ride'
);

-- Cancelling a day doesn't stop the owner going live for it again ------------------------- 1

update rides set status = 'CANCELLED' where id = (select ride_id from first_tap);
select ok(
  (select created and ride_id <> (select ride_id from first_tap)
     from go_live('00000000-0000-0000-0000-0000000000a7',
                  '30000000-0000-0000-0000-0000000000a7', (select day from d))),
  'after cancelling a day''s ride, going live again creates a new one'
);

-- Refusals --------------------------------------------------------------------------------- 5

select throws_ok($$
  select * from go_live('00000000-0000-0000-0000-0000000000a7',
                        '30000000-0000-0000-0000-0000000000a7',
                        ((now() at time zone 'Asia/Kolkata')::date + 5), null, 5::smallint)
$$, 'P0001', null, 'can''t offer more seats than the car has');
select throws_ok($$
  select * from go_live('00000000-0000-0000-0000-0000000000a7',
                        '30000000-0000-0000-0000-0000000000a7',
                        ((now() at time zone 'Asia/Kolkata')::date - 1))
$$, 'P0001', null, 'can''t go live for a time that has passed');
select throws_ok($$
  select * from go_live('00000000-0000-0000-0000-0000000000a8',
                        '30000000-0000-0000-0000-0000000000a7',
                        ((now() at time zone 'Asia/Kolkata')::date + 5))
$$, 'P0002', null, 'can''t go live with someone else''s usual ride');
select throws_ok($$
  select * from go_live('00000000-0000-0000-0000-0000000000a8',
                        '30000000-0000-0000-0000-0000000000a8',
                        ((now() at time zone 'Asia/Kolkata')::date + 5))
$$, 'P0001', null, 'can''t go live without a phone number (F-A2)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a7"}', true);
select throws_ok($$
  select * from go_live('00000000-0000-0000-0000-0000000000a7',
                        '30000000-0000-0000-0000-0000000000a7',
                        ((now() at time zone 'Asia/Kolkata')::date + 5))
$$, '42501', null, 'only the server can call it, not signed-in users directly');

select * from finish();
rollback;
