-- The local demo data (T-1.4), and the search query from docs/lld.md §1 run against it.
-- Needs the seed loaded, which `npm run db:reset` and a fresh `npm run db:start` (as in CI) do.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- The demo data ------------------------------------------------------------------------------ 5

select ok((select count(*) >= 3 from places), 'seed: the stop list is loaded');
select is(
  (select count(*) from users where id::text like '5eed0000-%' and name like 'Demo %'),
  3::bigint,
  'seed: three demo people, all named Demo …'
);
select is(
  (select count(*) from auth.users where id::text like '5eed0000-%' and email not like '%@example.com'),
  0::bigint,
  'seed: every demo email is an example.com address'
);
select is(
  (select count(*) from users where id::text like '5eed0000-%' and phone not like '+9199999%'),
  0::bigint,
  'seed: every demo phone is a +91 99999 placeholder'
);
select is(
  (select array_agg(s.seq order by s.seq) from ride_stops s
    where s.ride_id = '5eed0000-0000-0000-0000-0000000000d1'),
  array[0, 1, 2]::smallint[],
  'seed: tomorrow''s demo ride has a 3-stop route'
);

-- Search (lld.md §1) on the demo data: "Palwal → Shankar Chowk, tomorrow 07:00–09:00" ----- 4
-- The rider stands 300 m from the first stop and wants to get to the last one.

create temporary table search_input on commit drop as
select extensions.st_project(s_first.geo, 300, radians(0))::extensions.geography as from_point,
       s_last.geo as to_point,
       (((now() at time zone 'Asia/Kolkata')::date + 1 + time '07:00')
          at time zone 'Asia/Kolkata') as t_lo,
       (((now() at time zone 'Asia/Kolkata')::date + 1 + time '09:00')
          at time zone 'Asia/Kolkata') as t_hi
  from ride_stops s_first, ride_stops s_last
 where s_first.ride_id = '5eed0000-0000-0000-0000-0000000000d1' and s_first.seq = 0
   and s_last.ride_id = '5eed0000-0000-0000-0000-0000000000d1' and s_last.seq = 2;

-- The matcher behind search_rides(), as the demo rider.
create function pg_temp.search(p_from extensions.geography, p_to extensions.geography,
                               p_lo timestamptz, p_hi timestamptz)
returns table (ride_id uuid, pickup_seq smallint, drop_seq smallint)
language sql as $$
  select m.ride_id, m.pickup_seq, m.drop_seq
    from private.match_rides('5eed0000-0000-0000-0000-000000000002', p_from, p_to, p_lo, p_hi) m
$$;

select is(
  (select array_agg(ride_id) from search_input i, pg_temp.search(i.from_point, i.to_point, i.t_lo, i.t_hi)),
  array['5eed0000-0000-0000-0000-0000000000d1'::uuid],
  'search: finds the demo ride'
);
select is(
  (select pickup_seq || '→' || drop_seq
     from search_input i, pg_temp.search(i.from_point, i.to_point, i.t_lo, i.t_hi)),
  '0→2',
  'search: picks up at the first stop and drops at the last'
);
select is(
  (select count(*) from search_input i, pg_temp.search(i.to_point, i.from_point, i.t_lo, i.t_hi)),
  0::bigint,
  'search: the opposite direction finds nothing (pickup must come before drop)'
);
select is(
  (select count(*) from search_input i,
     pg_temp.search(extensions.st_project(i.from_point, 5000, radians(270))::extensions.geography,
                    i.to_point, i.t_lo, i.t_hi)),
  0::bigint,
  'search: a rider 5 km from every stop finds nothing'
);

select * from finish();
rollback;
