-- Pickup reminders (T-6.4, F-E3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email)
select ('00000000-0000-0000-0000-000000000d0' || n)::uuid, 'demo.remind' || n || '@example.com'
  from generate_series(0, 4) n;
insert into users (id, name, phone)
select ('00000000-0000-0000-0000-000000000d0' || n)::uuid, 'Demo Remind ' || n, '+91999994010' || n
  from generate_series(0, 4) n;
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000d00', '00000000-0000-0000-0000-000000000d00',
   'Demo Car', 'White', 'HR26DM0D00', 4);

-- "soon" sets off in 10 minutes and reaches its second stop 30 minutes later;
-- "later" sets off in an hour.
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat)
values
  ('30000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d00',
   '20000000-0000-0000-0000-000000000d00', now() + interval '10 minutes', now() - interval '10 hours', 4, 1, 100),
  ('30000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000d00',
   '20000000-0000-0000-0000-000000000d00', now() + interval '1 hour', now() - interval '10 hours', 4, 3, 100);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min)
select r, s, extensions.st_makepoint(77.3, 28.1 + s * 0.1)::extensions.geography, 'Demo Stop ' || s, s * 30
  from unnest(array['30000000-0000-0000-0000-000000000d01', '30000000-0000-0000-0000-000000000d02']::uuid[]) r,
       generate_series(0, 2) s;
-- Rider 1 gets in at the start of "soon", rider 2 at its second stop (40 minutes away), rider 3
-- cancelled, rider 4 is on "later".
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('30000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d01', 0, 2, 'CONFIRMED', now()),
  ('30000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d02', 1, 2, 'CONFIRMED', now()),
  ('30000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d03', 0, 2, 'CANCELLED', now()),
  ('30000000-0000-0000-0000-000000000d02', '00000000-0000-0000-0000-000000000d04', 0, 2, 'CONFIRMED', now());

create function pg_temp.reminders(p_user text, p_kind text default 'reminder') returns bigint language sql as $$
  select count(*) from notifications_outbox
   where user_id = ('00000000-0000-0000-0000-000000000d0' || p_user)::uuid and kind = p_kind
$$;

select is(run_reminders(), 2, 'one rider and the owner are due');
select is(pg_temp.reminders('1'), 1::bigint, 'rider 1, picked up in 10 minutes, is reminded');
select is(
  (select payload ->> 'stop' from notifications_outbox where user_id = '00000000-0000-0000-0000-000000000d01' and kind = 'reminder'),
  'Demo Stop 0', 'with their stop');
select is(pg_temp.reminders('2'), 0::bigint, 'rider 2''s stop is 40 minutes away: not yet');
select is(pg_temp.reminders('3'), 0::bigint, 'a cancelled rider isn''t reminded');
select is(pg_temp.reminders('0', 'owner_reminder'), 1::bigint, 'the owner is told it''s nearly time to set off');
select is(pg_temp.reminders('4'), 0::bigint, 'a ride an hour away waits');

select is(run_reminders(), 0, 'running again sends nothing');

-- Half an hour on, rider 2's pickup is due; nobody else is reminded twice.
update rides set depart_at = depart_at - interval '30 minutes', allocation_at = allocation_at - interval '30 minutes'
 where id = '30000000-0000-0000-0000-000000000d01';
select is(run_reminders() || ' ' || pg_temp.reminders('1') || ' ' || pg_temp.reminders('2'), '1 1 1',
  'later, rider 2 gets theirs, and rider 1 still has just the one');

select * from finish();
rollback;
