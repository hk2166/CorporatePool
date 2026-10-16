-- search_rides() (T-4.1, lld.md §1).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- People (all fake): rider M (a man), rider W (a woman), owner O with most rides, owner B who
-- blocked M, owner X whom M blocked.
insert into auth.users (id, email)
select ('00000000-0000-0000-0000-00000000030' || n)::uuid, 'demo.search' || n || '@example.com'
  from unnest(array['1', '2', '3', '4', '5']) as n;
insert into users (id, name, gender) values
  ('00000000-0000-0000-0000-000000000301', 'Demo Rider Man', 'male'),
  ('00000000-0000-0000-0000-000000000302', 'Demo Rider Woman', 'female'),
  ('00000000-0000-0000-0000-000000000303', 'Demo Owner Smith', null),
  ('00000000-0000-0000-0000-000000000304', 'Demo Owner Blocker', null),
  ('00000000-0000-0000-0000-000000000305', 'Demo Owner Blocked', null);
insert into cars (id, owner_id, model, colour, plate, seats_total)
select ('20000000-0000-0000-0000-00000000030' || n)::uuid,
       ('00000000-0000-0000-0000-00000000030' || n)::uuid,
       'Demo Car', 'White', 'HR26DM030' || n, 4
  from unnest(array['1', '3', '4', '5']) as n;
insert into blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000305');

-- The day after tomorrow in India, so the test works whenever it runs.
create temporary table d on commit drop as
select ((now() at time zone 'Asia/Kolkata')::date + 2) as day;

-- Rides by name. Stops are [lat, lng, minutes after departure]. The rider searches from
-- (28.140, 77.330) to (28.490, 77.090); 0.01° of latitude is about 1.1 km.
create temporary table names (name text primary key, id uuid not null) on commit drop;

create function pg_temp.ride(
  p_name text, p_owner text, p_depart time, p_stops numeric[][],
  p_status ride_status default 'OPEN', p_seats_left smallint default 3,
  p_women_only boolean default false
) returns void language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_depart timestamptz := ((select day from d) + p_depart) at time zone 'Asia/Kolkata';
  i integer;
begin
  insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                     price_per_seat, status, women_only)
  values (v_id, ('00000000-0000-0000-0000-00000000030' || p_owner)::uuid,
          ('20000000-0000-0000-0000-00000000030' || p_owner)::uuid,
          v_depart, v_depart - interval '10 hours', 3, p_seats_left, 120, p_status, p_women_only);
  for i in 1 .. array_length(p_stops, 1) loop
    insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
    values (v_id, i - 1,
            extensions.st_makepoint(p_stops[i][2], p_stops[i][1])::extensions.geography,
            'Demo ' || p_name || ' ' || i, p_stops[i][3]);
  end loop;
  insert into names values (p_name, v_id);
end
$$;

select pg_temp.ride('match',    '3', '08:00', '{{28.140,77.330,0},{28.300,77.200,35},{28.490,77.090,70}}');
select pg_temp.ride('opposite', '3', '08:00', '{{28.490,77.090,0},{28.300,77.200,35},{28.140,77.330,70}}');
select pg_temp.ride('far',      '3', '08:00', '{{28.159,77.330,0},{28.490,77.090,70}}');  -- 2.1 km
select pg_temp.ride('near',     '3', '08:00', '{{28.149,77.330,0},{28.490,77.090,70}}');  -- 1.0 km
select pg_temp.ride('full',     '3', '08:00', '{{28.140,77.330,0},{28.490,77.090,70}}', 'FULL', 0::smallint);
select pg_temp.ride('cancelled','3', '08:00', '{{28.140,77.330,0},{28.490,77.090,70}}', 'CANCELLED');
select pg_temp.ride('late',     '3', '11:00', '{{28.140,77.330,0},{28.490,77.090,70}}');
-- Starts further south and reaches the rider's stop at 07:45.
select pg_temp.ride('via',      '3', '07:15', '{{27.950,77.400,0},{28.140,77.330,30},{28.490,77.090,100}}');
select pg_temp.ride('one seat', '3', '08:30', '{{28.140,77.330,0},{28.490,77.090,70}}', 'ALLOCATING', 1::smallint);
select pg_temp.ride('women',    '3', '08:05', '{{28.140,77.330,0},{28.490,77.090,70}}', p_women_only => true);
select pg_temp.ride('mine',     '1', '08:00', '{{28.140,77.330,0},{28.490,77.090,70}}');
select pg_temp.ride('blocker',  '4', '08:00', '{{28.140,77.330,0},{28.490,77.090,70}}');
select pg_temp.ride('blocked',  '5', '08:00', '{{28.140,77.330,0},{28.490,77.090,70}}');

-- The names of the rides a search finds, best fit first.
create function pg_temp.found(
  p_time_from time default '00:00', p_time_to time default '23:59:59', p_seats smallint default 1
) returns text language sql as $$
  select coalesce(string_agg(n.name, ', ' order by s.ordinality), 'none')
    from search_rides(28.140, 77.330, 28.490, 77.090, (select day from d),
                      p_time_from, p_time_to, p_seats) with ordinality s
    join names n on n.id = s.ride_id
$$;

create function pg_temp.as_user(p_id text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', '00000000-0000-0000-0000-00000000030' || p_id)::text,
                    true)
$$;

-- Matching -------------------------------------------------------------------------------- 10

select pg_temp.as_user('1');

select is(pg_temp.found('07:00', '09:00'), 'via, match, near, one seat',
  'the rides that fit, best fit first');
select ok(pg_temp.found() not like '%opposite%',
  'a car going the other way isn''t found (its drop stop comes before the pickup)');
select ok(pg_temp.found() not like '%far%', 'a car whose nearest stop is 2.1 km away isn''t found');
select ok(pg_temp.found() not like '%full%', 'a full car isn''t found');
select ok(pg_temp.found() not like '%cancelled%', 'a cancelled ride isn''t found');
select is(pg_temp.found('07:00', '09:00', 2::smallint), 'via, match, near',
  'a car with fewer seats left than asked for isn''t found');
select is(pg_temp.found(), 'via, match, near, one seat, late',
  'without a window, the whole day (a later car ranks lower)');
select ok(pg_temp.found() not like '%mine%', 'the rider''s own ride isn''t found');
select ok(pg_temp.found() not like '%blocker%' and pg_temp.found() not like '%blocked%',
  'rides from someone who blocked the rider, or whom the rider blocked, aren''t found');
select ok(pg_temp.found() not like '%women%', 'a women-only ride isn''t shown to a man');

-- What a result says ------------------------------------------------------------------------ 5

select results_eq(
  $$ select s.pickup_seq, s.pickup_label, to_char(s.pickup_at at time zone 'Asia/Kolkata', 'HH24:MI'),
            s.pickup_walk_m, s.drop_seq, s.start_label, s.end_label
       from search_rides(28.140, 77.330, 28.490, 77.090, (select day from d)) s
       join names n on n.id = s.ride_id and n.name = 'via' $$,
  $$ values (1::smallint, 'Demo via 2', '07:45', 0, 2::smallint, 'Demo via 1', 'Demo via 3') $$,
  'a ride joined midway: the pickup is its second stop, at 07:45, with no walking'
);
select is(
  (select s.pickup_walk_m from search_rides(28.140, 77.330, 28.490, 77.090, (select day from d)) s
     join names n on n.id = s.ride_id and n.name = 'near'),
  997,
  'the walk to the nearest stop is given in metres'
);
select is(
  (select s.owner_first_name || ' · ' || s.car_model || ' · ' || s.price_per_seat
     from search_rides(28.140, 77.330, 28.490, 77.090, (select day from d)) s
     join names n on n.id = s.ride_id and n.name = 'match'),
  'Demo · Demo Car · 120',
  'the owner''s first name, the car and the price'
);

insert into bookings (ride_id, rider_id, pickup_seq, drop_seq)
values ((select id from names where name = 'match'), '00000000-0000-0000-0000-000000000301', 0, 2);
select is(
  (select s.my_booking_status from search_rides(28.140, 77.330, 28.490, 77.090, (select day from d)) s
     join names n on n.id = s.ride_id and n.name = 'match'),
  'REQUESTED'::booking_status,
  'a ride the rider already asked for says so'
);

select pg_temp.as_user('2');
select ok(pg_temp.found() like '%women%', 'a woman does see the women-only ride');

-- The matcher on its own ---------------------------------------------------------------------- 1

update rides set depart_at = now() - interval '1 hour', allocation_at = now() - interval '2 hours'
 where id = (select id from names where name = 'match');
select is(
  (select count(*) from private.match_rides(
     '00000000-0000-0000-0000-000000000301',
     extensions.st_makepoint(77.330, 28.140)::extensions.geography,
     extensions.st_makepoint(77.090, 28.490)::extensions.geography,
     now() - interval '3 hours', now() + interval '3 hours')),
  0::bigint,
  'a ride that has already left isn''t found'
);

-- Bad input and access ------------------------------------------------------------------------ 3

select throws_ok($$ select * from search_rides(28.1, 77.3, 28.5, 77.1, current_date, '09:00', '08:00') $$,
  '22023', null, 'a window that ends before it starts is refused');

set local role anon;
select throws_ok($$ select * from search_rides(28.1, 77.3, 28.5, 77.1, current_date) $$,
  '42501', null, 'visitors who aren''t signed in can''t search');

set local role authenticated;
select lives_ok($$ select * from search_rides(28.1, 77.3, 28.5, 77.1, current_date) $$,
  'signed-in users can');

select * from finish();
rollback;
