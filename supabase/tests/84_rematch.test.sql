-- Cross-car matching (T-5.4, lld.md §5): user flow 4 step 3 and user flow 7 step 2.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Only this test's cars: the demo data's ride (tomorrow 08:00 IST, same route, 3 seats) would
-- otherwise be "another car with room" whenever the clock puts this test's rides near it.
update rides set status = 'CANCELLED' where status <> 'CANCELLED';

-- Fake people: owners O1 (the 8:00), O2 (the 8:15), O3 (the 8:30 and an 11:00), riders A–E.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000080' || n)::uuid, 'demo.rematch' || n || '@example.com'
  from unnest(array['1', '2', '3', 'a', 'b', 'c', 'd', 'e']) as n;
insert into users (id, name, phone)
select ('00000000-0000-0000-0000-00000000080' || n)::uuid, 'Demo ' || upper(n), '+91999998000' || o
  from unnest(array['1', '2', '3', 'a', 'b', 'c', 'd', 'e']) with ordinality as t(n, o);
insert into cars (id, owner_id, model, colour, plate, seats_total)
select ('20000000-0000-0000-0000-00000000080' || n)::uuid,
       ('00000000-0000-0000-0000-00000000080' || n)::uuid, 'Demo Car', 'White', 'HR26DM080' || n, 4
  from unnest(array['1', '2', '3']) as n;

-- Rides on the same route, 10 hours from now ("8:00") and after. Seats on "8:00", "8:15" and
-- "11:00" are being handed out first come; "8:30" still waits for its 22:00 allocation.
create temporary table names (name text primary key, id uuid not null) on commit drop;
create function pg_temp.ride(p_name text, p_owner text, p_after interval, p_seats smallint,
                             p_alloc interval default '-1 hour')
returns void language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat)
  values (v_id, ('00000000-0000-0000-0000-00000000080' || p_owner)::uuid,
          ('20000000-0000-0000-0000-00000000080' || p_owner)::uuid,
          now() + interval '10 hours' + p_after, now() + p_alloc, p_seats, p_seats, 100);
  insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
    (v_id, 0, extensions.st_makepoint(77.33, 28.14)::extensions.geography, 'Demo Start', 0),
    (v_id, 1, extensions.st_makepoint(77.09, 28.49)::extensions.geography, 'Demo End', 70);
  insert into names values (p_name, v_id);
end
$$;
select pg_temp.ride('8:00', '1', '0 minutes', 1::smallint);
select pg_temp.ride('8:15', '2', '15 minutes', 2::smallint);
select pg_temp.ride('8:30', '3', '30 minutes', 3::smallint, '5 hours');
select pg_temp.ride('11:00', '3', '3 hours', 3::smallint);

create function pg_temp.id(p_name text) returns uuid language sql as $$
  select id from names where name = p_name
$$;
create function pg_temp.rider(p_letter text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-00000000080' || p_letter)::uuid
$$;
-- Where a rider stands now: "8:15 CONFIRMED", or "none".
create function pg_temp.where_is(p_letter text) returns text language sql as $$
  select coalesce(string_agg(n.name || ' ' || b.status || coalesce('#' || b.waitlist_rank, ''), ', '
                             order by n.name), 'none')
    from bookings b join names n on n.id = b.ride_id
   where b.rider_id = pg_temp.rider(p_letter) and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
$$;

-- User flow 4: the 8:00 is full; B and C are waitlisted. B ticked "any car is fine".
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, any_car_ok, created_at) values
  (pg_temp.id('8:00'), pg_temp.rider('a'), 0, 1, false, now() - interval '3 hours'),
  (pg_temp.id('8:00'), pg_temp.rider('b'), 0, 1, true,  now() - interval '2 hours'),
  (pg_temp.id('8:00'), pg_temp.rider('c'), 0, 1, false, now() - interval '1 hour');

-- User flow 4 step 3 ---------------------------------------------------------------------- 6

select is(run_allocation(), 1, 'allocation runs for the 8:00, then cross-car matching');
select is(pg_temp.where_is('a'), '8:00 CONFIRMED', 'A has the only seat on the 8:00');
select is(pg_temp.where_is('b'), '8:15 CONFIRMED',
  'B, waitlisted but happy with any car, is placed in the 8:15, the nearest in time with room');
select is(pg_temp.where_is('c'), '8:00 WAITLISTED#1',
  'C, who only wants the 8:00, stays on its waitlist and moves up to #1');
select is(
  (select count(*) from notifications_outbox
    where user_id = pg_temp.rider('b') and kind = 'booking_moved'),
  1::bigint, 'B is told "placed in the 8:15 instead"');
select is(
  (select seats_left from rides where id = pg_temp.id('8:15')), 1::smallint,
  'B took a seat on the 8:15');

-- User flow 7 step 2: the owner of the 8:15 cancels ------------------------------------------ 4

select is(cancel_ride(pg_temp.rider('2'), pg_temp.id('8:15'), 'Demo reason'), 1,
  'the 8:15 is cancelled with B on it');
select is(run_rematch(), 1, 'cross-car matching finds B another car');
select is(pg_temp.where_is('b'), '8:30 REQUESTED',
  'the 8:00 is full and the 11:00 is too far off, so B queues for the 8:30, whose seats '
  'are handed out at 22:00');
select is(
  (select rematch_requested from bookings where rider_id = pg_temp.rider('b') and ride_id = pg_temp.id('8:15')),
  false, 'B''s old booking is no longer looking');

-- When nothing fits ------------------------------------------------------------------------- 4

-- D was on the cancelled 8:15 too but wants 3 seats: no car has room.
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, seats, any_car_ok, status,
                      decided_at, rematch_requested)
values (pg_temp.id('8:15'), pg_temp.rider('d'), 0, 1, 3, true, 'CANCELLED', now(), true);
update rides set seats_left = 2 where id = pg_temp.id('8:30');
select is(run_rematch(), 0, 'nothing fits D');
select is(
  (select rematch_requested from bookings where rider_id = pg_temp.rider('d')),
  true, 'so D stays on the list for the next run');
update rides set depart_at = now() - interval '1 minute', allocation_at = now() - interval '2 hours'
 where id = pg_temp.id('8:15');
select is(run_rematch(), 0, 'once the 8:15''s time has passed…');
select is(
  (select rematch_requested from bookings where rider_id = pg_temp.rider('d')),
  false, '…D is no longer looked for');

select * from finish();
rollback;
