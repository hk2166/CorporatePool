-- cancel_ride() (T-3.5): the ride, its bookings, the riders' notifications and re-matching.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixtures (all fake). Owner O's ride L has seats already handed out (allocation was an hour
-- ago) and four bookings: R1 confirmed and happy with any car, R2 waitlisted, R3 requested, R4
-- cancelled earlier. Ride E hasn't reached allocation yet; ride P has already left.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-0000000001' || n)::uuid, 'demo.cancel' || n || '@example.com'
  from unnest(array['00', '01', '02', '03', '04']) as n;
insert into users (id, name, phone) values
  ('00000000-0000-0000-0000-000000000100', 'Demo Cancel Owner', '+919999940000'),
  ('00000000-0000-0000-0000-000000000101', 'Demo Rider One', null),
  ('00000000-0000-0000-0000-000000000102', 'Demo Rider Two', null),
  ('00000000-0000-0000-0000-000000000103', 'Demo Rider Three', null),
  ('00000000-0000-0000-0000-000000000104', 'Demo Rider Four', null);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000100',
   'Demo Hatchback', 'White', 'HR26DM0090', 4);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000100',
   '20000000-0000-0000-0000-000000000100', now() + interval '1 day', now() - interval '1 hour', 3, 2, 150),
  ('40000000-0000-0000-0000-00000000010e', '00000000-0000-0000-0000-000000000100',
   '20000000-0000-0000-0000-000000000100', now() + interval '2 days', now() + interval '1 day', 3, 3, 150),
  ('40000000-0000-0000-0000-00000000010f', '00000000-0000-0000-0000-000000000100',
   '20000000-0000-0000-0000-000000000100', now() - interval '1 hour', now() - interval '11 hours', 3, 3, 150);
insert into ride_stops (ride_id, seq, geo, label)
select r, s, extensions.st_makepoint(77.3 - s * 0.2, 28.1 + s * 0.4)::extensions.geography, 'Demo ' || s
  from unnest(array['40000000-0000-0000-0000-00000000010a', '40000000-0000-0000-0000-00000000010e',
                    '40000000-0000-0000-0000-00000000010f']::uuid[]) as r,
       unnest(array[0, 1]::smallint[]) as s;
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at, waitlist_rank, any_car_ok) values
  ('40000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000101', 0, 1, 'CONFIRMED', now(), null, true),
  ('40000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000102', 0, 1, 'WAITLISTED', now(), 1, false),
  ('40000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000103', 0, 1, 'REQUESTED', null, null, false),
  ('40000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000104', 0, 1, 'CANCELLED', now() - interval '1 day', null, true),
  ('40000000-0000-0000-0000-00000000010e', '00000000-0000-0000-0000-000000000101', 0, 1, 'REQUESTED', null, null, false);

-- Cancelling ride L ------------------------------------------------------------------------- 8

select is(
  cancel_ride('00000000-0000-0000-0000-000000000100', '40000000-0000-0000-0000-00000000010a',
              '  Car broke down  '),
  3,
  'three riders were affected (the already-cancelled booking isn''t counted)'
);
select is(
  (select status::text from rides where id = '40000000-0000-0000-0000-00000000010a'),
  'CANCELLED',
  'the ride is cancelled'
);
select is(
  (select count(*) from bookings
    where ride_id = '40000000-0000-0000-0000-00000000010a'
      and rider_id in ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102',
                       '00000000-0000-0000-0000-000000000103')
      and status = 'CANCELLED' and decided_at is not null and waitlist_rank is null),
  3::bigint,
  'the confirmed, waitlisted and requested bookings are all cancelled'
);
select is(
  (select decided_at < now() - interval '23 hours' from bookings
    where rider_id = '00000000-0000-0000-0000-000000000104'),
  true,
  'a booking cancelled earlier is left as it was'
);
select is(
  (select array_agg(u.name order by u.name) from bookings b join users u on u.id = b.rider_id
    where b.ride_id = '40000000-0000-0000-0000-00000000010a' and b.rematch_requested),
  array['Demo Rider One'],
  'only the rider happy with any car is flagged for re-matching'
);
select is(
  (select array_agg(u.name order by u.name) from notifications_outbox n join users u on u.id = n.user_id
    where n.kind = 'ride_cancelled'
      and n.payload ->> 'ride_id' = '40000000-0000-0000-0000-00000000010a'),
  array['Demo Rider One', 'Demo Rider Three', 'Demo Rider Two'],
  'each affected rider gets one "ride cancelled" notification'
);
select is(
  (select (payload ->> 'reason') || ' | ' || (payload ->> 'finding_another_car')
     from notifications_outbox
    where user_id = '00000000-0000-0000-0000-000000000101' and kind = 'ride_cancelled'),
  'Car broke down | true',
  'the notification carries the trimmed reason and whether another car is being found'
);
select is(
  (select points from reliability_events
    where ride_id = '40000000-0000-0000-0000-00000000010a' and kind = 'OWNER_LATE_CANCEL'),
  -5::smallint,
  'cancelling after seats were handed out, with a confirmed rider, costs the owner (once)'
);

-- An early cancel ---------------------------------------------------------------------------- 2

select is(
  cancel_ride('00000000-0000-0000-0000-000000000100', '40000000-0000-0000-0000-00000000010e'),
  1,
  'an early cancel affects its one rider'
);
select is(
  (select count(*) from reliability_events where ride_id = '40000000-0000-0000-0000-00000000010e'),
  0::bigint,
  'cancelling before seats are handed out costs nothing'
);

-- Refusals --------------------------------------------------------------------------------- 4

select throws_ok($$
  select cancel_ride('00000000-0000-0000-0000-000000000100', '40000000-0000-0000-0000-00000000010a')
$$, 'P0001', null, 'a ride can''t be cancelled twice');
select throws_ok($$
  select cancel_ride('00000000-0000-0000-0000-000000000100', '40000000-0000-0000-0000-00000000010f')
$$, 'P0001', null, 'a ride that has already left can''t be cancelled');
select throws_ok($$
  select cancel_ride('00000000-0000-0000-0000-000000000101', '40000000-0000-0000-0000-00000000010f')
$$, 'P0002', null, 'only the ride''s owner can cancel it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000100"}', true);
select throws_ok($$
  select cancel_ride('00000000-0000-0000-0000-000000000100', '40000000-0000-0000-0000-00000000010f')
$$, '42501', null, 'only the server can call it, not signed-in users directly');

select * from finish();
rollback;
