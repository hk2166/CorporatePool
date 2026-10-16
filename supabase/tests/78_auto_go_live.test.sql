-- run_auto_go_live() and its schedule (T-3.3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- The day after tomorrow in India, and its weekday bit (Mon = 1 … Sun = 64).
create temporary table d on commit drop as
select ((now() at time zone 'Asia/Kolkata')::date + 2) as day,
       1 << (extract(isodow from ((now() at time zone 'Asia/Kolkata')::date + 2))::integer - 1) as bit;

-- Five owners (all fake), each with a car and a usual ride:
--   A  every day                        → goes live
--   B  every day except that weekday    → doesn't
--   C  every day, but skipped that day  → doesn't
--   D  every day, but cancelled that day's ride already → stays cancelled
--   E  every day, but no phone number   → can't, and doesn't stop the others
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000020' || n)::uuid, 'demo.auto' || n || '@example.com'
  from unnest(array['a', 'b', 'c', 'd', 'e']) as n;
insert into users (id, name, phone) values
  ('00000000-0000-0000-0000-00000000020a', 'Demo Auto A', '+919999950001'),
  ('00000000-0000-0000-0000-00000000020b', 'Demo Auto B', '+919999950002'),
  ('00000000-0000-0000-0000-00000000020c', 'Demo Auto C', '+919999950003'),
  ('00000000-0000-0000-0000-00000000020d', 'Demo Auto D', '+919999950004'),
  ('00000000-0000-0000-0000-00000000020e', 'Demo Auto E', null);
insert into cars (id, owner_id, model, colour, plate, seats_total)
select ('20000000-0000-0000-0000-00000000020' || n)::uuid, ('00000000-0000-0000-0000-00000000020' || n)::uuid,
       'Demo Car', 'White', 'HR26DM020' || upper(n), 4
  from unnest(array['a', 'b', 'c', 'd', 'e']) as n;
insert into usual_rides (id, owner_id, car_id, depart_time, seats_offered, price_per_seat,
                         auto_golive_days, stops)
select ('30000000-0000-0000-0000-00000000020' || n)::uuid, ('00000000-0000-0000-0000-00000000020' || n)::uuid,
       ('20000000-0000-0000-0000-00000000020' || n)::uuid, '08:00', 3, 100,
       case n when 'b' then 127 & ~(select bit from d) else 127 end,
       '[{"label": "Demo From", "lat": 28.14, "lng": 77.33, "eta_offset_min": 0},
         {"label": "Demo To", "lat": 28.49, "lng": 77.09, "eta_offset_min": 70}]'
  from unnest(array['a', 'b', 'c', 'd', 'e']) as n;
insert into usual_ride_skips (usual_ride_id, day)
values ('30000000-0000-0000-0000-00000000020c', (select day from d));
-- D went live for that day and then cancelled it.
create temporary table d_went_live on commit drop as
select * from go_live('00000000-0000-0000-0000-00000000020d', '30000000-0000-0000-0000-00000000020d',
                      (select day from d));
update rides set status = 'CANCELLED' where usual_ride_id = '30000000-0000-0000-0000-00000000020d';

create function pg_temp.rides_on(p_usual uuid) returns text language sql as $$
  select coalesce(string_agg(status::text, ',' order by created_at), 'none') from rides
   where usual_ride_id = p_usual and (depart_at at time zone 'Asia/Kolkata')::date = (select day from d)
$$;

-- The first run ----------------------------------------------------------------------------- 7

select is(run_auto_go_live((select day from d)), 1, 'one ride goes live');
select is(pg_temp.rides_on('30000000-0000-0000-0000-00000000020a'), 'OPEN',
  'A, set for every day, is live');
select is(
  (select count(*) from notifications_outbox
    where user_id = '00000000-0000-0000-0000-00000000020a' and kind = 'ride_auto_live'),
  1::bigint,
  'A is told their ride is live'
);
select is(pg_temp.rides_on('30000000-0000-0000-0000-00000000020b'), 'none',
  'B, not set for that weekday, isn''t');
select is(pg_temp.rides_on('30000000-0000-0000-0000-00000000020c'), 'none',
  'C skipped that day, so no ride');
select is(pg_temp.rides_on('30000000-0000-0000-0000-00000000020d'), 'CANCELLED',
  'D''s cancelled day stays cancelled (no second ride)');
select is(pg_temp.rides_on('30000000-0000-0000-0000-00000000020e'), 'none',
  'E has no phone number, so no ride, and the others still went live');

-- Running again changes nothing -------------------------------------------------------------- 2

select is(run_auto_go_live((select day from d)), 0, 'a second run creates nothing');
select is(pg_temp.rides_on('30000000-0000-0000-0000-00000000020a'), 'OPEN', 'A still has exactly one ride');

-- The schedule ------------------------------------------------------------------------------- 1

select is(
  (select schedule from cron.job where jobname = 'auto-go-live'),
  '30 11 * * *',
  'the job runs every day at 11:30 UTC, which is 17:00 in India'
);

-- Access ------------------------------------------------------------------------------------- 3

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000020c"}', true);
select is((select count(*) from usual_ride_skips), 1::bigint, 'C sees their own skipped day');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000020a"}', true);
select is((select count(*) from usual_ride_skips), 0::bigint, 'A doesn''t see C''s skips');
select throws_ok($$ select run_auto_go_live() $$, '42501', null,
  'only the database''s own job (or the server) can run it');

select * from finish();
rollback;
