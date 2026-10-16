-- The admin's numbers (T-7.1): rankings and occupancy, reconciled with raw SQL.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-000000000f0' || n)::uuid, 'demo.numbers' || n || '@example.com'
  from generate_series(0, 4) n;
insert into users (id, name, phone, is_admin, reliability_score)
select ('00000000-0000-0000-0000-000000000f0' || n)::uuid, 'Demo Numbers ' || n, '+91999996010' || n,
       n = 0, (array[50, 99, 98, 20, 50])[n + 1]
  from generate_series(0, 4) n;
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f01', 'Demo Car', 'White', 'HR26DM0F01', 4);

-- Day D (far in the past, so nothing else in the database is on it): two rides on one route,
-- one cancelled ride, and a ride on another route.
create temporary table d on commit drop as select date '2020-01-15' as day;
grant select on d to authenticated;
create function pg_temp.ride(p_id text, p_seats smallint, p_from text, p_to text,
                             p_status ride_status default 'COMPLETED')
returns void language sql as $$
  insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat, status)
  values (('30000000-0000-0000-0000-000000000f0' || p_id)::uuid, '00000000-0000-0000-0000-000000000f01',
          '20000000-0000-0000-0000-000000000f01',
          ((select day from d) + time '08:00') at time zone 'Asia/Kolkata',
          ((select day from d) - 1 + time '22:00') at time zone 'Asia/Kolkata', p_seats, 0, 100, p_status);
  insert into ride_stops (ride_id, seq, geo, label) values
    (('30000000-0000-0000-0000-000000000f0' || p_id)::uuid, 0, extensions.st_makepoint(77.3, 28.1)::extensions.geography, p_from),
    (('30000000-0000-0000-0000-000000000f0' || p_id)::uuid, 1, extensions.st_makepoint(77.1, 28.5)::extensions.geography, p_to);
$$;
select pg_temp.ride('1', 4::smallint, 'Demo Palwal', 'Demo Office');
select pg_temp.ride('2', 3::smallint, 'Demo Palwal', 'Demo Office');
select pg_temp.ride('3', 4::smallint, 'Demo Palwal', 'Demo Office', 'CANCELLED');
select pg_temp.ride('4', 2::smallint, 'Demo Metro', 'Demo Office');
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, seats, status, decided_at, waitlist_rank) values
  ('30000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f02', 0, 1, 1, 'COMPLETED', now(), null),
  ('30000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f03', 0, 1, 1, 'NO_SHOW', now(), null),
  ('30000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-000000000f04', 0, 1, 2, 'CANCELLED', now(), null),
  ('30000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-000000000f02', 0, 1, 2, 'COMPLETED', now(), null),
  ('30000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-000000000f03', 0, 1, 1, 'CANCELLED', now(), null),
  ('30000000-0000-0000-0000-000000000f04', '00000000-0000-0000-0000-000000000f04', 0, 1, 1, 'EXPIRED', now(), null);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000f00"}', true);

-- Occupancy -------------------------------------------------------------------------------- 4

select results_eq(
  $$ select route, rides, seats_offered, seats_filled from admin_occupancy((select day from d), (select day from d)) $$,
  $$ values ('Demo Metro → Demo Office', 1::bigint, 2::bigint, 0::bigint),
            ('Demo Palwal → Demo Office', 2::bigint, 7::bigint, 4::bigint) $$,
  'per route: rides, seats offered, seats filled (cancelled rides and bookings left out)'
);
reset role;
-- The same numbers straight from the tables.
create temporary table raw on commit drop as
select (select count(*) from rides r where r.status <> 'CANCELLED'
          and (r.depart_at at time zone 'Asia/Kolkata')::date = (select day from d)) as rides,
       (select sum(r.seats_total) from rides r where r.status <> 'CANCELLED'
          and (r.depart_at at time zone 'Asia/Kolkata')::date = (select day from d)) as offered,
       (select sum(b.seats) from bookings b join rides r on r.id = b.ride_id
         where r.status <> 'CANCELLED' and b.status in ('CONFIRMED', 'COMPLETED', 'NO_SHOW')
           and (r.depart_at at time zone 'Asia/Kolkata')::date = (select day from d)) as filled;
grant select on raw to authenticated;
set local role authenticated;
select is(
  (select row(sum(rides), sum(seats_offered), sum(seats_filled))::text
     from admin_occupancy((select day from d), (select day from d))),
  (select row(rides, offered, filled)::text from raw),
  'the totals reconcile with raw SQL');
select is((select count(*) from admin_occupancy((select day from d) + 1, (select day from d) + 30)),
  0::bigint, 'only the days asked for');
select is((select count(*) from admin_occupancy((select day from d) - 1, (select day from d))),
  2::bigint, 'a range covers each day in it');

-- Rankings --------------------------------------------------------------------------------- 2

select is(
  (select array_agg(name order by ord) from (
     select name, row_number() over () as ord from admin_rankings()
      where name like 'Demo Numbers %') t),
  array['Demo Numbers 1', 'Demo Numbers 2', 'Demo Numbers 0', 'Demo Numbers 4', 'Demo Numbers 3'],
  'everyone, most reliable first');
select is(
  (select rides_completed || ' ' || no_shows_90d from admin_rankings() where user_id = '00000000-0000-0000-0000-000000000f03'),
  '0 0', 'with their counts');

-- Admins only ------------------------------------------------------------------------------ 2

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000f01"}', true);
select throws_ok($$ select * from admin_rankings() $$, '42501', 'Admins only', 'a member can''t see the rankings');
select throws_ok($$ select * from admin_occupancy(current_date, current_date) $$, '42501', 'Admins only',
  'or the occupancy');

select * from finish();
rollback;
