-- Route alerts: members hear about cars going their way, right away or in an evening summary.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Owner O; riders: R (right away), D (evening summary), F (off), N (no notifications switched
-- on), V (drives only); W is a woman who wants alerts too.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001901', 'demo.ra.owner@example.com'),
  ('00000000-0000-0000-0000-000000001902', 'demo.ra.r@example.com'),
  ('00000000-0000-0000-0000-000000001903', 'demo.ra.d@example.com'),
  ('00000000-0000-0000-0000-000000001904', 'demo.ra.f@example.com'),
  ('00000000-0000-0000-0000-000000001905', 'demo.ra.n@example.com'),
  ('00000000-0000-0000-0000-000000001906', 'demo.ra.v@example.com'),
  ('00000000-0000-0000-0000-000000001907', 'demo.ra.w@example.com');
insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-000000001901', 'Demo RA Home', extensions.st_makepoint(77.30, 28.10)::extensions.geography),
  ('10000000-0000-0000-0000-000000001902', 'Demo RA Office', extensions.st_makepoint(77.10, 28.50)::extensions.geography);
insert into users (id, name, phone, ride_preference, ride_alerts, gender, home_place_id, work_place_id) values
  ('00000000-0000-0000-0000-000000001901', 'Demo RA Owner', '+919999981901', 'DRIVER', 'INSTANT', null, null, null),
  ('00000000-0000-0000-0000-000000001902', 'Demo RA R', null, 'RIDER', 'INSTANT', 'male',
   '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902'),
  ('00000000-0000-0000-0000-000000001903', 'Demo RA D', null, 'RIDER', 'DIGEST', null,
   '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902'),
  ('00000000-0000-0000-0000-000000001904', 'Demo RA F', null, 'BOTH', 'OFF', null,
   '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902'),
  ('00000000-0000-0000-0000-000000001905', 'Demo RA N', null, 'RIDER', 'INSTANT', null,
   '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902'),
  ('00000000-0000-0000-0000-000000001906', 'Demo RA V', null, 'DRIVER', 'INSTANT', null,
   '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902'),
  ('00000000-0000-0000-0000-000000001907', 'Demo RA W', null, 'RIDER', 'INSTANT', 'female',
   '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902');
insert into push_subscriptions (user_id, endpoint, p256dh, auth)
select id, 'https://push.example.com/' || id, repeat('k', 40), repeat('a', 16) from users
 where id in ('00000000-0000-0000-0000-000000001902', '00000000-0000-0000-0000-000000001903',
              '00000000-0000-0000-0000-000000001904', '00000000-0000-0000-0000-000000001906',
              '00000000-0000-0000-0000-000000001907');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000001901', '00000000-0000-0000-0000-000000001901', 'Demo Car', 'Red', 'HR26DM1901', 4);

-- Tomorrow: a morning car home → office, an evening car office → home, and a women-only car.
create function pg_temp.ride(p_id uuid, p_time time, p_women boolean, p_first uuid, p_last uuid)
returns void language sql as $$
  insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat, women_only)
  values (p_id, '00000000-0000-0000-0000-000000001901', '20000000-0000-0000-0000-000000001901',
          (((now() at time zone 'Asia/Kolkata')::date + 1) + p_time) at time zone 'Asia/Kolkata',
          (((now() at time zone 'Asia/Kolkata')::date) + time '22:00') at time zone 'Asia/Kolkata',
          3, 3, 110, p_women);
  insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
  select p_id, s.seq, p.geo, p.name, s.seq * 60
    from (values (0, p_first), (1, p_last)) as s(seq, place)
    join places p on p.id = s.place;
$$;
select pg_temp.ride('30000000-0000-0000-0000-000000001901', '08:00', false,
  '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902');
select pg_temp.ride('30000000-0000-0000-0000-000000001902', '18:00', false,
  '10000000-0000-0000-0000-000000001902', '10000000-0000-0000-0000-000000001901');
select pg_temp.ride('30000000-0000-0000-0000-000000001903', '09:00', true,
  '10000000-0000-0000-0000-000000001901', '10000000-0000-0000-0000-000000001902');

create function pg_temp.alerts(p_user uuid, p_kind text default 'ride_on_route') returns bigint
language sql as $$ select count(*) from notifications_outbox where user_id = p_user and kind = p_kind $$;

select run_route_alerts();

-- Right away ---------------------------------------------------------------------------------- 6

select results_eq(
  $$ select payload ->> 'direction', payload ->> 'from', payload ->> 'to', payload ->> 'price'
       from notifications_outbox where user_id = '00000000-0000-0000-0000-000000001902'
        and kind = 'ride_on_route' order by payload ->> 'direction' desc $$,
  $$ values ('MORNING', 'Demo RA Home', 'Demo RA Office', '110'),
            ('EVENING', 'Demo RA Office', 'Demo RA Home', '110') $$,
  'a rider hears about the morning car to the office and the evening car home');
select is(pg_temp.alerts('00000000-0000-0000-0000-000000001907'), 3::bigint,
  'women hear about women-only cars too; men don''t');
select is(
  pg_temp.alerts('00000000-0000-0000-0000-000000001903') + pg_temp.alerts('00000000-0000-0000-0000-000000001904'),
  0::bigint, 'nothing right away for members who chose the summary or switched alerts off');
select is(pg_temp.alerts('00000000-0000-0000-0000-000000001905'), 0::bigint,
  'nor for members without notifications switched on');
select is(
  pg_temp.alerts('00000000-0000-0000-0000-000000001906') + pg_temp.alerts('00000000-0000-0000-0000-000000001901'),
  0::bigint, 'nor for members who only drive, or the owner');
select run_route_alerts();
select is(pg_temp.alerts('00000000-0000-0000-0000-000000001902'), 2::bigint,
  'each car is told once');

-- The evening summary ------------------------------------------------------------------------ 3

select run_route_digest();
select results_eq(
  $$ select payload ->> 'morning', payload ->> 'evening' from notifications_outbox
      where user_id = '00000000-0000-0000-0000-000000001903' and kind = 'route_digest' $$,
  $$ values ('1', '1') $$,
  'the summary counts tomorrow''s cars each way');
select is(pg_temp.alerts('00000000-0000-0000-0000-000000001902', 'route_digest'), 0::bigint,
  'and goes only to members who chose it');
update users set work_place_id = null where id = '00000000-0000-0000-0000-000000001903';
delete from notifications_outbox where kind = 'route_digest';
select run_route_digest();
select is(pg_temp.alerts('00000000-0000-0000-0000-000000001903', 'route_digest'), 0::bigint,
  'nothing without a commute');

-- Members choose ------------------------------------------------------------------------------ 3

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001902"}', true);
update users set ride_alerts = 'DIGEST' where id = '00000000-0000-0000-0000-000000001902';
select is((select ride_alerts from get_my_profile()), 'DIGEST', 'members choose for themselves');
select throws_ok($$ update users set ride_alerts = 'LOUD' where id = '00000000-0000-0000-0000-000000001902' $$,
  '23514', null, 'right away, summary or off');
reset role;
select throws_ok($$ select run_route_alerts() $$, '42501', null, 'the jobs aren''t for members')
  from (select set_config('role', 'authenticated', true)) s;

select * from finish();
rollback;
