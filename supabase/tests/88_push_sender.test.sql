-- The push sender's side of the outbox (T-6.3, lld.md §6): claim, report back, retry.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Only this test's notifications are waiting.
update notifications_outbox set status = 'SENT', sent_at = now() where status = 'PENDING';

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000c01', 'demo.push@example.com');
insert into users (id, name, phone) values ('00000000-0000-0000-0000-000000000c01', 'Demo Push', '+919999930101');
insert into notifications_outbox (id, user_id, kind, payload, created_at) values
  ('40000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c01', 'booking_confirmed', '{}', now() - interval '3 minutes'),
  ('40000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000c01', 'ride_full', '{}', now() - interval '2 minutes'),
  ('40000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-000000000c01', 'ride_started', '{}', now() - interval '1 minute');

create function pg_temp.state(p_id text) returns text language sql as $$
  select status || ' ' || attempts from notifications_outbox where id = ('40000000-0000-0000-0000-000000000c0' || p_id)::uuid
$$;

-- Claiming --------------------------------------------------------------------------------- 4

select is(
  (select array_agg(right(id::text, 1) order by id) from claim_notifications(2)),
  array['1', '2'], 'a sender claims a batch, oldest first');
select is(pg_temp.state('1'), 'PENDING 1', 'a claimed row counts the try but stays pending until sent');
select is(
  (select array_agg(right(id::text, 1)) from claim_notifications(10)),
  array['3'], 'a second sender meanwhile gets only what nobody is working on');
select is((select count(*) from claim_notifications(10)), 0::bigint, 'and then nothing');

-- Reporting back ------------------------------------------------------------------------------ 3

select finish_notifications(array['40000000-0000-0000-0000-000000000c01']::uuid[],
                            array['40000000-0000-0000-0000-000000000c02']::uuid[]);
select is(pg_temp.state('1'), 'SENT 1', 'sent is done');
select is(pg_temp.state('2'), 'PENDING 1', 'a failed send waits for the next run');
select is((select array_agg(right(id::text, 1)) from claim_notifications(10)), array['2'],
  'and is claimed again');

-- A crash between claiming and sending (lld.md §6) ------------------------------------------- 2

-- Row 3 was claimed and its sender died: two minutes on, the claim has run out.
update notifications_outbox set claimed_until = now() - interval '1 second'
 where id = '40000000-0000-0000-0000-000000000c03';
select is((select array_agg(right(id::text, 1)) from claim_notifications(10)), array['3'],
  'a claim nobody reported back on runs out, and the notification goes out on a later run');
select is(pg_temp.state('3'), 'PENDING 2', 'that was its second try');

-- Giving up ----------------------------------------------------------------------------------- 3

update notifications_outbox set attempts = 10, claimed_until = null where id = '40000000-0000-0000-0000-000000000c02';
select finish_notifications('{}', array['40000000-0000-0000-0000-000000000c02']::uuid[]);
select is(pg_temp.state('2'), 'FAILED 10', 'after 10 tries a notification is given up on');
update notifications_outbox set attempts = 10, claimed_until = now() - interval '1 second'
 where id = '40000000-0000-0000-0000-000000000c03';
select is((select count(*) from claim_notifications(10)), 0::bigint, 'and so is one whose last try never reported back…');
select is(pg_temp.state('3'), 'FAILED 10', '…which is marked failed');

-- Waking the sender ----------------------------------------------------------------------------- 3

delete from vault.secrets where name in ('app_url', 'cron_secret');
select is(private.wake_push_sender(), false, 'not set up yet: notifications just wait');
do $$
begin
  perform vault.create_secret('https://demo.example.com/', 'app_url');
  perform vault.create_secret('demo-secret', 'cron_secret');
end
$$;
create temporary table queued_before on commit drop as select count(*) as n from net.http_request_queue;
insert into notifications_outbox (user_id, kind) values ('00000000-0000-0000-0000-000000000c01', 'booking_promoted');
select is(
  (select count(*) from net.http_request_queue) - (select n from queued_before), 1::bigint,
  'writing a notification wakes the sender (sent by pg_net once the transaction commits)');
select is(
  (select url || ' ' || (headers ->> 'Authorization') from net.http_request_queue order by id desc limit 1),
  'https://demo.example.com/api/jobs/send-pushes Bearer demo-secret',
  'at the address and with the secret kept in Vault');

-- Schedule and access ----------------------------------------------------------------------------- 2

select is((select schedule from cron.job where jobname = 'send-pushes'), '* * * * *',
  'every minute, anything still waiting is retried');
set local role authenticated;
select throws_ok($$ select * from claim_notifications(1) $$, '42501', null,
  'only the server can claim notifications');

select * from finish();
rollback;
