-- anonymise_account() (T-2.4): nothing identifying is left, history is kept.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Fixtures (all fake). D is the person deleting their account. They own two cars (one used
-- in a past ride, one never used), a usual ride, a push subscription, blocks both ways and a
-- queued notification. R rode in D's past ride; D rode once in O's past ride. E has an
-- upcoming ride.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d0', 'demo.deleting@example.com'),
  ('00000000-0000-0000-0000-0000000000d1', 'demo.del.rider@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'demo.del.owner@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'demo.del.busy@example.com');
insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-0000000000d0', 'Demo Delete Stop',
   extensions.st_makepoint(77.30, 28.20)::extensions.geography);
insert into users (id, name, phone, upi_vpa, gender, photo_url, home_place_id, is_admin) values
  ('00000000-0000-0000-0000-0000000000d0', 'Demo Deletable Person', '+919812345678',
   'demo.deletable@okdemo', 'female', 'https://lh3.googleusercontent.com/a/deletable',
   '10000000-0000-0000-0000-0000000000d0', true),
  ('00000000-0000-0000-0000-0000000000d1', 'Demo Del Rider', null, null, null, null, null, false),
  ('00000000-0000-0000-0000-0000000000d2', 'Demo Del Owner', null, null, null, null, null, false),
  ('00000000-0000-0000-0000-0000000000d3', 'Demo Del Busy', null, null, null, null, null, false);
insert into cars (id, owner_id, model, colour, plate, seats_total, photo_paths) values
  ('20000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d0',
   'Demo Used Car', 'Red', 'HR26DM0070', 4, array['00000000-0000-0000-0000-0000000000d0/used.jpg']),
  ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d0',
   'Demo Spare Car', 'Blue', 'HR26DM0071', 4, array['00000000-0000-0000-0000-0000000000d0/spare.jpg']),
  ('20000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d2',
   'Demo Other Car', 'Grey', 'HR26DM0072', 4, '{}'),
  ('20000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d3',
   'Demo Busy Car', 'Black', 'HR26DM0073', 4, '{}');
insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops) values
  ('00000000-0000-0000-0000-0000000000d0', '20000000-0000-0000-0000-0000000000d0', '08:00', 3, 150,
   '[{"label": "a"}, {"label": "b"}]');
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat, status) values
  -- D's past ride, R rode in it
  ('40000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d0',
   '20000000-0000-0000-0000-0000000000d0',
   '2026-09-01 08:00+05:30', '2026-08-31 22:00+05:30', 3, 2, 150, 'COMPLETED'),
  -- O's past ride, D rode in it
  ('40000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d2',
   '20000000-0000-0000-0000-0000000000d2',
   '2026-09-02 08:00+05:30', '2026-09-01 22:00+05:30', 3, 2, 150, 'COMPLETED'),
  -- E's upcoming ride
  ('40000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d3',
   '20000000-0000-0000-0000-0000000000d3',
   '2026-12-01 08:00+05:30', '2026-11-30 22:00+05:30', 3, 3, 150, 'OPEN');
insert into ride_stops (ride_id, seq, geo, label) values
  ('40000000-0000-0000-0000-0000000000d0', 0, extensions.st_makepoint(77.3, 28.1)::extensions.geography, 'Demo A'),
  ('40000000-0000-0000-0000-0000000000d0', 1, extensions.st_makepoint(77.1, 28.5)::extensions.geography, 'Demo B'),
  ('40000000-0000-0000-0000-0000000000d2', 0, extensions.st_makepoint(77.3, 28.1)::extensions.geography, 'Demo A'),
  ('40000000-0000-0000-0000-0000000000d2', 1, extensions.st_makepoint(77.1, 28.5)::extensions.geography, 'Demo B');
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('40000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d1', 0, 1, 'COMPLETED', now()),
  ('40000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d0', 0, 1, 'COMPLETED', now());
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://fcm.googleapis.com/fcm/send/demo-deleting', '00000000-0000-0000-0000-0000000000d0',
   repeat('B', 87), repeat('a', 22));
insert into blocks (blocker_id, blocked_id) values
  ('00000000-0000-0000-0000-0000000000d0', '00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d0');
insert into notifications_outbox (user_id, kind) values
  ('00000000-0000-0000-0000-0000000000d0', 'seat_confirmed');

-- Counts rows anywhere in public that still contain a piece of text.
create function pg_temp.mentions(p_text text) returns bigint language plpgsql as $$
declare
  t record;
  found_here bigint;
  total bigint := 0;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('select count(*) from public.%I x where to_jsonb(x)::text like %L',
                   t.tablename, '%' || p_text || '%')
      into found_here;
    total := total + found_here;
  end loop;
  return total;
end
$$;

-- Delete D's account ---------------------------------------------------------------------- 1

select is(
  (select array_agg(p order by p)
     from unnest(anonymise_account('00000000-0000-0000-0000-0000000000d0')) as p),
  array['00000000-0000-0000-0000-0000000000d0/spare.jpg',
        '00000000-0000-0000-0000-0000000000d0/used.jpg'],
  'returns the car photo files for the server to delete'
);

-- Nothing identifying is left -------------------------------------------------------------- 11

select is(
  (select row(name, phone, upi_vpa, gender, photo_url, home_place_id, is_admin)::text
     from users where id = '00000000-0000-0000-0000-0000000000d0'),
  '("Deleted user",,,,,,f)',
  'the profile becomes "Deleted user" with every personal field cleared and admin removed'
);
select is((select count(*) from cars where id = '20000000-0000-0000-0000-0000000000d1'),
  0::bigint, 'a car nobody rode in is deleted');
select is(
  (select model || ' | ' || colour || ' | ' || (plate like 'DEL%') || ' | ' || cardinality(photo_paths)
     from cars where id = '20000000-0000-0000-0000-0000000000d0'),
  'Deleted car | Unknown | true | 0',
  'a car with past rides keeps its row but loses plate, photos, model and colour'
);
select is((select count(*) from usual_rides where owner_id = '00000000-0000-0000-0000-0000000000d0'),
  0::bigint, 'usual rides are deleted');
select is((select count(*) from push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000d0'),
  0::bigint, 'push subscriptions are deleted');
select is(
  (select count(*) from blocks
    where '00000000-0000-0000-0000-0000000000d0' in (blocker_id, blocked_id)),
  0::bigint, 'blocks are deleted, both ways');
select is((select count(*) from notifications_outbox where user_id = '00000000-0000-0000-0000-0000000000d0'),
  0::bigint, 'queued notifications are deleted');
select is(pg_temp.mentions('+919812345678'), 0::bigint, 'the phone number appears nowhere');
select is(pg_temp.mentions('demo.deletable@okdemo'), 0::bigint, 'the UPI ID appears nowhere');
select is(pg_temp.mentions('HR26DM0070'), 0::bigint, 'the number plate appears nowhere');
select is(pg_temp.mentions('Demo Deletable Person'), 0::bigint, 'the name appears nowhere');

-- History other people depend on is kept --------------------------------------------------- 2

select is(
  (select count(*) from bookings b join rides r on r.id = b.ride_id
    where r.owner_id = '00000000-0000-0000-0000-0000000000d0'),
  1::bigint,
  'the rider''s booking on the deleted person''s past ride is kept'
);
select is(
  (select u.name from bookings b join users u on u.id = b.rider_id
    where b.ride_id = '40000000-0000-0000-0000-0000000000d2'),
  'Deleted user',
  'their own past booking on someone else''s ride now shows "Deleted user"'
);

-- Refusals --------------------------------------------------------------------------------- 3

select throws_ok($$
  select anonymise_account('00000000-0000-0000-0000-0000000000d3')
$$, 'P0001', null, 'refused while the person has an upcoming ride');
select throws_ok($$
  select anonymise_account('00000000-0000-0000-0000-0000000000ff')
$$, 'P0002', null, 'refused for someone who isn''t a member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1"}', true);
select throws_ok($$
  select anonymise_account('00000000-0000-0000-0000-0000000000d1')
$$, '42501', null, 'only the server can call it, not signed-in users');

select * from finish();
rollback;
