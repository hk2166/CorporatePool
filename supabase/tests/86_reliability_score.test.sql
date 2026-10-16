-- The reliability score (T-6.1, lld.md §3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- The formula ----------------------------------------------------------------------------------- 7

select is(private.reliability_score(0, 0, 0), 50::smallint, 'a new rider starts at 50');
select is(private.reliability_score(5, 0, 0), 60::smallint, '+2 for each completed ride');
select is(private.reliability_score(20, 0, 0), 90::smallint, 'up to +40 (20 rides)…');
select is(private.reliability_score(300, 0, 0), 90::smallint, '…and no further');
select is(private.reliability_score(10, 1, 0), 55::smallint, '−15 for a no-show');
select is(private.reliability_score(10, 0, 1), 65::smallint, '−5 for a late cancel');
select is(private.reliability_score(0, 5, 0), 0::smallint, 'never below 0');

-- Kept up to date from the events ------------------------------------------------------------- 6

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a01', 'demo.score1@example.com'),
  ('00000000-0000-0000-0000-000000000a02', 'demo.score2@example.com');
insert into users (id, name, phone) values
  ('00000000-0000-0000-0000-000000000a01', 'Demo Rider', '+919999910001'),
  ('00000000-0000-0000-0000-000000000a02', 'Demo Owner', '+919999910002');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000a02',
   'Demo Car', 'White', 'HR26DM0A02', 4);

-- Twelve past rides for the rider: ten completed, one no-show, one late cancel.
create temporary table past on commit drop as
select gen_random_uuid() as ride_id, gen_random_uuid() as booking_id, n
  from generate_series(1, 12) n;
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat, status)
select ride_id, '00000000-0000-0000-0000-000000000a02', '20000000-0000-0000-0000-000000000a02',
       now() - n * interval '1 day', now() - n * interval '1 day' - interval '10 hours', 3, 3, 100,
       'COMPLETED'
  from past;
insert into ride_stops (ride_id, seq, geo, label)
select ride_id, s, extensions.st_makepoint(77.3, 28.1 + s)::extensions.geography, 'Demo Stop ' || s
  from past, generate_series(0, 1) s;
insert into bookings (id, ride_id, rider_id, pickup_seq, drop_seq, status, decided_at)
select booking_id, ride_id, '00000000-0000-0000-0000-000000000a01', 0, 1,
       case n when 11 then 'NO_SHOW' when 12 then 'CANCELLED' else 'COMPLETED' end::booking_status,
       now()
  from past;

create function pg_temp.numbers() returns text language sql as $$
  select reliability_score || ' (' || rides_completed || ' rides, ' || no_shows_90d
         || ' no-shows, ' || late_cancels_90d || ' late)'
    from users where id = '00000000-0000-0000-0000-000000000a01'
$$;

select is(pg_temp.numbers(), '50 (0 rides, 0 no-shows, 0 late)', 'no events yet: 50');

insert into reliability_events (user_id, kind, booking_id, points)
select '00000000-0000-0000-0000-000000000a01', 'COMPLETED', booking_id, 2 from past where n <= 10;
select is(pg_temp.numbers(), '70 (10 rides, 0 no-shows, 0 late)',
  'each event updates the score straight away: ten rides, +20');

insert into reliability_events (user_id, kind, booking_id, points)
select '00000000-0000-0000-0000-000000000a01', 'NO_SHOW', booking_id, -15 from past where n = 11;
insert into reliability_events (user_id, kind, booking_id, points)
select '00000000-0000-0000-0000-000000000a01', 'LATE_CANCEL', booking_id, -5 from past where n = 12;
select is(pg_temp.numbers(), '50 (10 rides, 1 no-shows, 1 late)', 'a no-show and a late cancel: −20');

delete from reliability_events where kind = 'NO_SHOW';
select is(pg_temp.numbers(), '65 (10 rides, 0 no-shows, 1 late)',
  'removing an event (a no-show undone) gives the points back');

insert into reliability_events (user_id, kind, ride_id, points)
select '00000000-0000-0000-0000-000000000a02', 'OWNER_LATE_CANCEL', ride_id, -5 from past where n = 1;
select is(
  (select reliability_score || ' ' || late_cancels_90d from users where id = '00000000-0000-0000-0000-000000000a02'),
  '45 1', 'an owner''s late cancel counts too');

-- What the cached numbers are for: allocation ranks by them.
select ok(
  (select reliability_score from users where id = '00000000-0000-0000-0000-000000000a01')
  > (select reliability_score from users where id = '00000000-0000-0000-0000-000000000a02'),
  'the regular rider now ranks above the owner who cancelled late');

-- Decay: the nightly recompute ------------------------------------------------------------------ 3

-- The late cancel was 91 days ago.
update reliability_events set created_at = now() - interval '91 days' where kind = 'LATE_CANCEL';
select is(recompute_scores(), 1, 'the nightly run changes the one score that decayed');
select is(pg_temp.numbers(), '70 (10 rides, 0 no-shows, 0 late)',
  'after 90 days a late cancel stops counting; completed rides never do');
select is((select count(*) from cron.job where jobname = 'recompute-scores' and schedule = '30 21 * * *'),
  1::bigint, 'it runs at 03:00 in India');

select * from finish();
rollback;
