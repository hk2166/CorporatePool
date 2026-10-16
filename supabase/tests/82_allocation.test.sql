-- Seat allocation (T-5.2, lld.md §4): 5 requests, 3 seats.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Fake people: owner O, riders A–F with known reliability scores.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000060' || n)::uuid, 'demo.alloc' || n || '@example.com'
  from unnest(array['0', 'a', 'b', 'c', 'd', 'e', 'f']) as n;
insert into users (id, name, phone, reliability_score) values
  ('00000000-0000-0000-0000-000000000600', 'Demo Owner', '+919999960000', 50),
  ('00000000-0000-0000-0000-00000000060a', 'Demo A', '+919999960001', 80),
  ('00000000-0000-0000-0000-00000000060b', 'Demo B', '+919999960002', 50),
  ('00000000-0000-0000-0000-00000000060c', 'Demo C', '+919999960003', 50),
  ('00000000-0000-0000-0000-00000000060d', 'Demo D', '+919999960004', 95),
  ('00000000-0000-0000-0000-00000000060e', 'Demo E', '+919999960005', 30),
  ('00000000-0000-0000-0000-00000000060f', 'Demo F', '+919999960006', 100);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000600',
   'Demo Car', 'White', 'HR26DM0600', 4);

-- Three rides, all leaving in 10 hours with 3 seats:
--   main     allocation time passed, 5 requests waiting
--   early    allocation time still ahead, 1 request waiting
--   second   allocation time passed, 2 requests waiting, for the "a request arrives first" case
create temporary table names (name text primary key, id uuid not null) on commit drop;
insert into names values
  ('main', gen_random_uuid()), ('early', gen_random_uuid()), ('second', gen_random_uuid());
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat)
select n.id, '00000000-0000-0000-0000-000000000600', '20000000-0000-0000-0000-000000000600',
       now() + interval '10 hours',
       now() + case n.name when 'early' then interval '2 hours' else interval '-5 minutes' end,
       3, 3, 100
  from names n;
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
select n.id, s, extensions.st_makepoint(77.3, 28.1 + s * 0.2)::extensions.geography,
       'Demo Stop ' || s, s * 30
  from names n, generate_series(0, 1) s;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select id from names where name = p_name
$$;
create function pg_temp.rider(p_letter text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000060' || p_letter)::uuid
$$;
-- Who has what on a ride: "a:CONFIRMED b:WAITLISTED#1 …", by rider.
create function pg_temp.outcome(p_ride text) returns text language sql as $$
  select string_agg(right(b.rider_id::text, 1) || ':' || b.status || coalesce('#' || b.waitlist_rank, ''),
                    ' ' order by b.rider_id)
    from bookings b where b.ride_id = pg_temp.id(p_ride) and b.status <> 'CANCELLED'
$$;

-- The 5 requests on "main", asked for in this order (B before C, a minute apart).
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, created_at)
select pg_temp.id('main'), pg_temp.rider(l), 0, 1, now() - interval '1 hour' + o * interval '1 minute'
  from unnest(array['e', 'b', 'c', 'a', 'd']) with ordinality as t(l, o);
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq)
values (pg_temp.id('early'), pg_temp.rider('f'), 0, 1);

-- The job --------------------------------------------------------------------------------- 8

select is(run_allocation(), 1, 'the job allocates the one ride that''s due ("early" isn''t yet)');
select is(pg_temp.outcome('main'),
  'a:CONFIRMED b:CONFIRMED c:WAITLISTED#1 d:CONFIRMED e:WAITLISTED#2',
  'the 3 most reliable get the seats (D 95, A 80, then B, who asked before C at the same 50); '
  'C and E are waitlisted in that order');
select is((select seats_left || ' ' || status from rides where id = pg_temp.id('main')), '0 FULL',
  'the car is full');
select is(
  (select count(*) from notifications_outbox
    where kind = 'booking_confirmed' and payload ->> 'ride_id' = pg_temp.id('main')::text),
  3::bigint, 'the three confirmed riders are told');
select is(
  (select string_agg(payload ->> 'rank', ',' order by payload ->> 'rank') from notifications_outbox
    where kind = 'booking_waitlisted' and payload ->> 'ride_id' = pg_temp.id('main')::text),
  '1,2', 'the two waitlisted riders are told their place');
select is(pg_temp.outcome('early'), 'f:REQUESTED', 'a ride before its allocation time is left alone');

select is(run_allocation(), 0, 'running the job again finds nothing to do');
select is(pg_temp.outcome('main'),
  'a:CONFIRMED b:CONFIRMED c:WAITLISTED#1 d:CONFIRMED e:WAITLISTED#2',
  'and changes nothing');

-- After allocation --------------------------------------------------------------------------- 2

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000609', 'demo.alloc9@example.com');
insert into users (id, name, phone) values ('00000000-0000-0000-0000-000000000609', 'Demo Late', '+919999960010');
select is(
  (select status || '#' || waitlist_rank from request_seat(pg_temp.rider('9'), pg_temp.id('main'), 0::smallint, 1::smallint)),
  'WAITLISTED#3', 'a request after allocation joins the end of the waitlist');
select is((select count(*) from cron.job where jobname = 'allocate-seats' and schedule = '*/5 * * * *'),
  1::bigint, 'the job runs every 5 minutes');

-- A request that arrives before the job ---------------------------------------------------------- 4

insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, created_at) values
  (pg_temp.id('second'), pg_temp.rider('e'), 0, 1, now() - interval '2 hours'),
  (pg_temp.id('second'), pg_temp.rider('c'), 0, 1, now() - interval '1 hour');
-- E and C are waitlisted on "main", which leaves at the same time; that doesn't stop them here.
select is(
  (select status::text from request_seat(pg_temp.rider('f'), pg_temp.id('second'), 0::smallint, 1::smallint)),
  'CONFIRMED',
  'F asks after allocation time, before the job: the ride is allocated first and F gets the seat left'
);
select is(pg_temp.outcome('second'), 'c:CONFIRMED e:CONFIRMED f:CONFIRMED',
  'C and E, who asked in time, were placed first');
select is(
  (select string_agg(status::text, ',') from bookings
    where ride_id = pg_temp.id('main') and rider_id in (pg_temp.rider('c'), pg_temp.rider('e'))),
  'CANCELLED,CANCELLED',
  'and their places on the other car''s waitlist were given up'
);
select is(
  (select status::text from bookings where ride_id = pg_temp.id('early') and rider_id = pg_temp.rider('f')),
  'CANCELLED', 'as was F''s request on the car at the same time'
);

-- One car at a time ---------------------------------------------------------------------------- 1

select throws_ok(
  $$ select request_seat(pg_temp.rider('a'), pg_temp.id('early'), 0::smallint, 1::smallint) $$,
  'P0001', 'You already have a seat in a car around then',
  'a rider with a confirmed seat can''t ask for another car at the same time'
);

-- Access --------------------------------------------------------------------------------------- 2

set local role authenticated;
select throws_ok($$ select run_allocation() $$, '42501', null, 'riders can''t run the job');
set local role anon;
select throws_ok($$ select run_allocation() $$, '42501', null, 'nor can visitors');

select * from finish();
rollback;
