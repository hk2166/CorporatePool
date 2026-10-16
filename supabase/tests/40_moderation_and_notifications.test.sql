-- Rules on reports, admin_actions, push_subscriptions and notifications_outbox (T-1.2, part 5).
-- Each rule gets a test that tries to break it. Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Tables exist, with Row-Level Security on (deny-all until T-1.3) --------------------------- 8

select has_table('public', t, format('%s exists', t))
  from unnest(array['reports', 'admin_actions', 'push_subscriptions', 'notifications_outbox']) as t;

select ok(c.relrowsecurity, format('RLS is on for %s', c.relname))
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('reports', 'admin_actions', 'push_subscriptions', 'notifications_outbox')
 order by c.relname;

-- Fixtures: a reporter, the person reported, an admin, and someone with only a subscription

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'demo.reporter@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'demo.reported@example.com'),
  ('00000000-0000-0000-0000-0000000000e3', 'demo.admin@example.com'),
  ('00000000-0000-0000-0000-0000000000e4', 'demo.subscriber@example.com');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-0000000000e1', 'Demo Reporter', false),
  ('00000000-0000-0000-0000-0000000000e2', 'Demo Reported', false),
  ('00000000-0000-0000-0000-0000000000e3', 'Demo Admin', true),
  ('00000000-0000-0000-0000-0000000000e4', 'Demo Subscriber', false);

-- reports ------------------------------------------------------------------------------------ 6

select lives_ok($$
  insert into reports (id, by_user, about_user, reason) values
    ('60000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
     '00000000-0000-0000-0000-0000000000e2', 'Booked and never turned up, three times.')
$$, 'reports: a report is accepted');

select throws_ok($$
  insert into reports (by_user, about_user, reason) values
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
     'Reporting myself.')
$$, '23514', null, 'reports: you can''t report yourself');

select throws_ok($$
  insert into reports (by_user, about_user, reason) values
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'bad')
$$, '23514', null, 'reports: the reason says at least a few words');

select throws_ok($$
  update reports set status = 'RESOLVED' where id = '60000000-0000-0000-0000-0000000000e1'
$$, '23514', null, 'reports: resolving records when it happened');

select throws_ok($$
  update reports set resolved_at = now() where id = '60000000-0000-0000-0000-0000000000e1'
$$, '23514', null, 'reports: an open report has no resolution time');

select throws_ok($$
  update reports set status = 'IGNORED', resolved_at = now()
   where id = '60000000-0000-0000-0000-0000000000e1'
$$, '22P02', null, 'reports: status is OPEN, RESOLVED or DISMISSED');

-- admin_actions ------------------------------------------------------------------------------ 8

select lives_ok($$
  insert into admin_actions (admin_id, action, target_user, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'REMOVE_USER', '00000000-0000-0000-0000-0000000000e2',
     'Repeated no-shows after warnings.')
$$, 'admin_actions: removing a user is recorded');

select throws_ok($$
  insert into admin_actions (admin_id, action, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'REMOVE_USER', 'Who?')
$$, '23514', null, 'admin_actions: removing a user names the user');

select throws_ok($$
  insert into admin_actions (admin_id, action, target_user, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'HIDE_RIDE', '00000000-0000-0000-0000-0000000000e2',
     'Spam ride.')
$$, '23514', null, 'admin_actions: hiding a ride names the ride');

select throws_ok($$
  insert into admin_actions (admin_id, action, target_user, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'RESOLVE_REPORT', '00000000-0000-0000-0000-0000000000e2',
     'Handled.')
$$, '23514', null, 'admin_actions: resolving a report names the report');

select lives_ok($$
  insert into admin_actions (admin_id, action, target_report, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'RESOLVE_REPORT', '60000000-0000-0000-0000-0000000000e1',
     'User removed.')
$$, 'admin_actions: resolving a report is recorded');

select throws_ok($$
  insert into admin_actions (admin_id, action, target_user, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'RESTORE_USER', '00000000-0000-0000-0000-0000000000e2',
     '  ')
$$, '23514', null, 'admin_actions: every action gives a reason');

select throws_ok($$
  insert into admin_actions (admin_id, action, target_user, reason) values
    ('00000000-0000-0000-0000-0000000000e3', 'BAN_FOREVER', '00000000-0000-0000-0000-0000000000e2',
     'No.')
$$, '22P02', null, 'admin_actions: action is one of the documented kinds');

select throws_ok($$
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000e3'
$$, '23503', null, 'admin_actions: the audit trail can''t be erased by deleting the admin');

-- push_subscriptions ------------------------------------------------------------------------- 5

select lives_ok($$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('https://fcm.googleapis.com/fcm/send/demo-endpoint-1', '00000000-0000-0000-0000-0000000000e4',
     repeat('B', 87), repeat('a', 22))
$$, 'push_subscriptions: a browser subscription is accepted');

select throws_ok($$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('https://fcm.googleapis.com/fcm/send/demo-endpoint-1', '00000000-0000-0000-0000-0000000000e1',
     repeat('B', 87), repeat('a', 22))
$$, '23505', null, 'push_subscriptions: one row per browser');

select throws_ok($$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('http://insecure.example.com/push', '00000000-0000-0000-0000-0000000000e1',
     repeat('B', 87), repeat('a', 22))
$$, '23514', null, 'push_subscriptions: push services are https only');

select throws_ok($$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('https://fcm.googleapis.com/fcm/send/demo-endpoint-2', '00000000-0000-0000-0000-0000000000e1',
     'short', repeat('a', 22))
$$, '23514', null, 'push_subscriptions: the browser key has a plausible length');

delete from auth.users where id = '00000000-0000-0000-0000-0000000000e4';
select is(
  (select count(*) from push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000e4'),
  0::bigint,
  'push_subscriptions: deleting an account removes its subscriptions'
);

-- notifications_outbox ----------------------------------------------------------------------- 7

select lives_ok($$
  insert into notifications_outbox (id, user_id, kind, payload) values
    ('70000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
     'seat_confirmed', '{"ride_id": "demo"}')
$$, 'notifications_outbox: a pending notification is accepted');

select throws_ok($$
  insert into notifications_outbox (user_id, kind) values
    ('00000000-0000-0000-0000-0000000000e1', 'Seat Confirmed')
$$, '23514', null, 'notifications_outbox: kind is snake_case');

select throws_ok($$
  insert into notifications_outbox (user_id, kind, payload) values
    ('00000000-0000-0000-0000-0000000000e1', 'seat_confirmed', '[1, 2]')
$$, '23514', null, 'notifications_outbox: payload is an object');

select throws_ok($$
  update notifications_outbox set status = 'SENT' where id = '70000000-0000-0000-0000-0000000000e1'
$$, '23514', null, 'notifications_outbox: SENT records when it was sent');

select lives_ok($$
  update notifications_outbox set status = 'SENT', sent_at = now(), attempts = 1
   where id = '70000000-0000-0000-0000-0000000000e1'
$$, 'notifications_outbox: marking it sent works');

select throws_ok($$
  update notifications_outbox set attempts = 11 where id = '70000000-0000-0000-0000-0000000000e1'
$$, '23514', null, 'notifications_outbox: at most 10 tries');

select throws_ok($$
  update notifications_outbox set status = 'QUEUED' where id = '70000000-0000-0000-0000-0000000000e1'
$$, '22P02', null, 'notifications_outbox: status is PENDING, SENT or FAILED');

select * from finish();
rollback;
