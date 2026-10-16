-- cancel_booking(), waitlist promotion and the sweep (T-5.3, lld.md §5, user flow 5).
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Fake people: owner O and riders A–F.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000070' || n)::uuid, 'demo.cancel' || n || '@example.com'
  from unnest(array['0', 'a', 'b', 'c', 'd', 'e', 'f']) as n;
insert into users (id, name, phone)
select ('00000000-0000-0000-0000-00000000070' || n)::uuid, 'Demo ' || upper(n), '+91999997000' || o
  from unnest(array['0', 'a', 'b', 'c', 'd', 'e', 'f']) with ordinality as t(n, o);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000700',
   'Demo Car', 'White', 'HR26DM0700', 4);

-- "today": leaves in 10 hours, seats handed out an hour ago (first come from now on), 2 seats.
-- "tomorrow": seats not handed out yet.
create temporary table names (name text primary key, id uuid not null) on commit drop;
insert into names values ('today', gen_random_uuid()), ('tomorrow', gen_random_uuid());
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat)
select n.id, '00000000-0000-0000-0000-000000000700', '20000000-0000-0000-0000-000000000700',
       now() + case n.name when 'today' then interval '10 hours' else interval '2 days' end,
       now() + case n.name when 'today' then interval '-1 hour' else interval '1 day' end,
       2, 2, 100
  from names n;
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
select n.id, s, extensions.st_makepoint(77.3, 28.1 + s * 0.2)::extensions.geography,
       'Demo Stop ' || s, s * 30
  from names n, generate_series(0, 1) s;

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select id from names where name = p_name
$$;
create function pg_temp.rider(p_letter text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000070' || p_letter)::uuid
$$;
create function pg_temp.booking(p_letter text, p_ride text default 'today') returns uuid language sql as $$
  select id from bookings
   where rider_id = pg_temp.rider(p_letter) and ride_id = pg_temp.id(p_ride)
   order by created_at desc limit 1
$$;
create function pg_temp.ask(p_letter text, p_ride text, p_seats smallint default 1)
returns text language sql as $$
  select r.status || coalesce('#' || r.waitlist_rank, '')
    from request_seat(pg_temp.rider(p_letter), pg_temp.id(p_ride), 0::smallint, 1::smallint, p_seats) r
$$;
create function pg_temp.line(p_ride text default 'today') returns text language sql as $$
  select (select seats_left || ' ' || status from rides where id = pg_temp.id(p_ride)) || ' | ' ||
         coalesce((select string_agg(right(b.rider_id::text, 1) || ':' || b.status
                                       || coalesce('#' || b.waitlist_rank, ''),
                                     ' ' order by b.rider_id)
                     from bookings b
                    where b.ride_id = pg_temp.id(p_ride) and b.status <> 'CANCELLED'), '')
$$;

-- A and B take the 2 seats; C (wants 2), D and E are waitlisted.
do $$
begin
  perform pg_temp.ask('a', 'today');
  perform pg_temp.ask('b', 'today');
  perform pg_temp.ask('c', 'today', 2::smallint);
  perform pg_temp.ask('d', 'today');
  perform pg_temp.ask('e', 'today');
end
$$;
select is(pg_temp.line(),
  '0 FULL | a:CONFIRMED b:CONFIRMED c:WAITLISTED#1 d:WAITLISTED#2 e:WAITLISTED#3',
  'the starting point: full, three waiting');

-- User flow 5: a confirmed rider cancels on the day ----------------------------------------- 7

select is(cancel_booking(pg_temp.rider('a'), pg_temp.booking('a')), true,
  'A cancels a confirmed seat after allocation time: a late cancel');
select is(pg_temp.line(), '0 FULL | b:CONFIRMED c:WAITLISTED#1 d:CONFIRMED e:WAITLISTED#2',
  'the seat goes straight to D: C wants two and keeps first place, and E moves up to #2');
select is(
  (select kind || ' ' || points from reliability_events where booking_id = pg_temp.booking('a')),
  'LATE_CANCEL -5', 'it costs A 5 reliability points');
select is(
  (select count(*) from notifications_outbox
    where user_id = pg_temp.rider('d') and kind = 'booking_promoted'),
  1::bigint, 'D is told "you''re in"');
select is(
  (select count(*) from notifications_outbox
    where user_id = pg_temp.rider('0') and kind = 'booking_cancelled'),
  1::bigint, 'the owner hears that A dropped out');
select throws_ok($$ select cancel_booking(pg_temp.rider('a'), pg_temp.booking('a')) $$,
  'P0001', 'This booking can no longer be cancelled', 'a booking can only be cancelled once');
select throws_ok($$ select cancel_booking(pg_temp.rider('b'), pg_temp.booking('d')) $$,
  'P0002', 'No such booking', 'nobody can cancel someone else''s booking');

-- Leaving the waitlist ------------------------------------------------------------------------- 3

select is(cancel_booking(pg_temp.rider('e'), pg_temp.booking('e')), false,
  'leaving the waitlist is never late');
select is(pg_temp.line(), '0 FULL | b:CONFIRMED c:WAITLISTED#1 d:CONFIRMED',
  'E is off the list');
select is((select count(*) from reliability_events where booking_id = pg_temp.booking('e')),
  0::bigint, 'and loses nothing');

-- Nobody who fits is waiting ------------------------------------------------------------------- 2

select is(cancel_booking(pg_temp.rider('b'), pg_temp.booking('b')), true, 'B cancels too');
select is(pg_temp.line(), '1 OPEN | c:WAITLISTED#1 d:CONFIRMED',
  'C still wants two, so the seat shows as free again (flow 5 step 3)');

-- The sweep ------------------------------------------------------------------------------------ 3

-- A promotion that should have happened but didn't: a second seat comes free without one.
update rides set seats_left = 2 where id = pg_temp.id('today');
select is(run_promotion_sweep(), 1, 'the sweep finds the missed promotion');
select is(pg_temp.line(), '0 FULL | c:CONFIRMED d:CONFIRMED', 'C gets both seats');
select is(run_promotion_sweep(), 0, 'and a second run finds nothing');

-- Before allocation time ------------------------------------------------------------------------ 2

do $$ begin perform pg_temp.ask('f', 'tomorrow'); end $$;
select is(cancel_booking(pg_temp.rider('f'), pg_temp.booking('f', 'tomorrow')), false,
  'withdrawing a request before seats are handed out is never late');
select is(pg_temp.line('tomorrow'), '2 OPEN | ', 'and the ride is untouched');

-- After departure ------------------------------------------------------------------------------- 1

update rides set depart_at = now() - interval '1 minute', allocation_at = now() - interval '2 hours'
 where id = pg_temp.id('today');
select throws_ok($$ select cancel_booking(pg_temp.rider('c'), pg_temp.booking('c')) $$,
  'P0001', 'This booking can no longer be cancelled',
  'once the car has left, it''s a no-show for the owner to mark, not a cancel');

-- Schedule and access --------------------------------------------------------------------------- 3

select is((select count(*) from cron.job where jobname = 'promote-waitlist' and schedule = '*/5 * * * *'),
  1::bigint, 'the sweep runs every 5 minutes');
set local role authenticated;
select throws_ok(
  $$ select cancel_booking('00000000-0000-0000-0000-00000000070c', gen_random_uuid()) $$,
  '42501', null, 'riders cancel through the server, not directly');
select throws_ok($$ select run_promotion_sweep() $$, '42501', null, 'nor can they run the sweep');

select * from finish();
rollback;
