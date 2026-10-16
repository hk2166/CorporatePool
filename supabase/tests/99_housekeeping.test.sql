-- Keeping the free project awake and tidy: the daily clean-up deletes only what has outlived
-- its use, and never members, rides or their history.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000002001', 'demo.hk.admin@example.com'),
  ('00000000-0000-0000-0000-000000002002', 'demo.hk.member@example.com'),
  ('00000000-0000-0000-0000-000000002003', 'demo.hk.accepted@example.com'),
  ('00000000-0000-0000-0000-000000002004', 'demo.hk.rejected@example.com');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-000000002001', 'Demo HK Admin', true),
  ('00000000-0000-0000-0000-000000002002', 'Demo HK Member', false),
  ('00000000-0000-0000-0000-000000002003', 'Demo HK Accepted', false);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002002', 'Demo Car', 'Blue', 'HR26DM2001', 4);
insert into usual_rides (id, owner_id, car_id, depart_time, seats_offered, price_per_seat, stops) values
  ('40000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002002',
   '20000000-0000-0000-0000-000000002001', '08:00', 3, 100,
   '[{"label": "A", "lat": 28.1, "lng": 77.3, "eta_offset_min": 0}, {"label": "B", "lat": 28.5, "lng": 77.1, "eta_offset_min": 60}]');
-- A ride from ten days ago: history, which stays.
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat, status) values
  ('30000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002002', '20000000-0000-0000-0000-000000002001',
   now() - interval '10 days', now() - interval '11 days', 3, 3, 100, 'COMPLETED');

-- Old (more than 2 days) and recent of everything the clean-up looks at.
-- (Run ids given here: the test can't use cron's own counter.)
insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time) values
  (999, 990000001, 1, 'postgres', 'postgres', 'select 1', 'succeeded', 'demo old', now() - interval '3 days', now() - interval '3 days'),
  (999, 990000002, 1, 'postgres', 'postgres', 'select 1', 'succeeded', 'demo new', now() - interval '1 hour', now() - interval '1 hour');
insert into notifications_outbox (user_id, kind, created_at) values
  ('00000000-0000-0000-0000-000000002002', 'demo_old', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000002002', 'demo_new', now() - interval '1 hour');
insert into signup_tokens (token, created_by, max_uses, created_at, expires_at) values
  ('demo-hk-ended', '00000000-0000-0000-0000-000000002001', 10, now() - interval '10 days', now() - interval '3 days'),
  ('demo-hk-open', '00000000-0000-0000-0000-000000002001', 10, now() - interval '10 days', now() + interval '3 days');
insert into usual_ride_skips (usual_ride_id, day) values
  ('40000000-0000-0000-0000-000000002001', (now() at time zone 'Asia/Kolkata')::date - 5),
  ('40000000-0000-0000-0000-000000002001', (now() at time zone 'Asia/Kolkata')::date + 1);
insert into stop_requests (requested_by, name, status, created_at, decided_at) values
  ('00000000-0000-0000-0000-000000002002', 'Demo HK Added', 'ADDED', now() - interval '5 days', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000002002', 'Demo HK Waiting', 'PENDING', now() - interval '5 days', null),
  ('00000000-0000-0000-0000-000000002002', 'Demo HK Turned Down', 'REJECTED', now() - interval '5 days', now() - interval '1 hour');
insert into join_requests (user_id, name, status, created_at, decided_at) values
  ('00000000-0000-0000-0000-000000002003', 'Demo HK Accepted', 'ACCEPTED', now() - interval '5 days', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000002004', 'Demo HK Rejected', 'REJECTED', now() - interval '5 days', now() - interval '3 days');
insert into member_activity (user_id, day) values
  ('00000000-0000-0000-0000-000000002002', (now() at time zone 'Asia/Kolkata')::date - 150),
  ('00000000-0000-0000-0000-000000002002', (now() at time zone 'Asia/Kolkata')::date - 10);

select run_housekeeping();

select results_eq($$ select return_message from cron.job_run_details where jobid = 999 $$,
  $$ values ('demo new'::text) $$, 'the jobs'' run log keeps only the last 2 days');
select results_eq($$ select kind from notifications_outbox where user_id = '00000000-0000-0000-0000-000000002002' $$,
  $$ values ('demo_new'::text) $$, 'old notifications go');
select results_eq($$ select token from signup_tokens where token like 'demo-hk-%' $$,
  $$ values ('demo-hk-open'::text) $$, 'invite links that ended go; open ones stay');
select results_eq($$ select day > (now() at time zone 'Asia/Kolkata')::date from usual_ride_skips
                      where usual_ride_id = '40000000-0000-0000-0000-000000002001' $$,
  $$ values (true) $$, 'skipped days that have passed go');
select results_eq($$ select name from stop_requests where name like 'Demo HK %' order by name $$,
  $$ values ('Demo HK Turned Down'::text), ('Demo HK Waiting'::text) $$,
  'stop requests dealt with over 2 days ago go; waiting and recent ones stay');
select results_eq($$ select status from join_requests where name like 'Demo HK %' $$,
  $$ values ('REJECTED'::text) $$, 'accepted join requests go; rejections stay so they stick');
select results_eq($$ select (now() at time zone 'Asia/Kolkata')::date - day from member_activity
                      where user_id = '00000000-0000-0000-0000-000000002002' $$,
  $$ values (10) $$, 'daily activity is kept for 120 days');
select is(
  (select count(*) from rides where id = '30000000-0000-0000-0000-000000002001')
  + (select count(*) from users where id in ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000002003')),
  3::bigint, 'members and old rides are never touched');

select ok(keep_alive() > now() - interval '1 minute', 'keep_alive writes now');
select is((select count(*) from private.keep_alive), 1::bigint, 'in a single row, updated in place');

set local role authenticated;
select throws_ok($$ select run_housekeeping() $$, '42501', null, 'members can''t run the clean-up');

select * from finish();
rollback;
