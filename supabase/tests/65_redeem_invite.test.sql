-- redeem_invite() (T-2.1): one invite use plus one new profile, in one step.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c0', 'demo.inviter@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'demo.newcomer1@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'demo.newcomer2@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'demo.newcomer3@example.com');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-0000000000c0', 'Demo Inviter', true);
insert into signup_tokens (token, created_by, max_uses, expires_at) values
  ('demo-invite-one-use-aaaaaaaa', '00000000-0000-0000-0000-0000000000c0', 1, now() + interval '7 days'),
  ('demo-invite-expired-bbbbbbbb', '00000000-0000-0000-0000-0000000000c0', 5, now() + interval '1 second');
-- Make the second invite expired without breaking the "expiry after creation" rule.
update signup_tokens set created_at = now() - interval '2 days', expires_at = now() - interval '1 day'
 where token = 'demo-invite-expired-bbbbbbbb';

-- A valid invite: profile created, one use spent
select ok(
  redeem_invite('demo-invite-one-use-aaaaaaaa', '00000000-0000-0000-0000-0000000000c1',
                '  Demo Newcomer  ', 'https://lh3.googleusercontent.com/demo'),
  'a valid invite lets a newcomer in'
);
select is(
  (select name from users where id = '00000000-0000-0000-0000-0000000000c1'),
  'Demo Newcomer',
  'their Google name becomes their profile name, trimmed'
);
select is(
  (select used_count from signup_tokens where token = 'demo-invite-one-use-aaaaaaaa'),
  1,
  'the invite has one use spent'
);

-- Redeeming again as an existing member doesn't spend anything
select ok(
  redeem_invite('demo-invite-one-use-aaaaaaaa', '00000000-0000-0000-0000-0000000000c1', 'x', null),
  'an existing member redeeming again is fine…'
);
select is(
  (select used_count from signup_tokens where token = 'demo-invite-one-use-aaaaaaaa'),
  1,
  '…and uses up nothing'
);

-- Used up, expired, unknown
select ok(
  not redeem_invite('demo-invite-one-use-aaaaaaaa', '00000000-0000-0000-0000-0000000000c2', 'Demo Two', null),
  'a used-up invite lets nobody else in'
);
select ok(
  not redeem_invite('demo-invite-expired-bbbbbbbb', '00000000-0000-0000-0000-0000000000c2', 'Demo Two', null),
  'an expired invite lets nobody in'
);
select ok(
  not redeem_invite('no-such-invite-cccccccccccc', '00000000-0000-0000-0000-0000000000c2', 'Demo Two', null),
  'an unknown invite lets nobody in'
);
select is(
  (select count(*) from users where id = '00000000-0000-0000-0000-0000000000c2'),
  0::bigint,
  'no profile was created by the failed attempts'
);

-- Odd input from Google: no name, and a photo URL that isn't http(s)
insert into signup_tokens (token, created_by, expires_at) values
  ('demo-invite-odd-input-dddddd', '00000000-0000-0000-0000-0000000000c0', now() + interval '1 day');
select ok(
  redeem_invite('demo-invite-odd-input-dddddd', '00000000-0000-0000-0000-0000000000c3',
                null, 'javascript:alert(1)'),
  'an invite with odd input from Google still works…'
);
select is(
  (select name || ' / ' || coalesce(photo_url, 'no photo') from users
    where id = '00000000-0000-0000-0000-0000000000c3'),
  'New member / no photo',
  '…and a missing name and an unsafe photo URL are replaced, not stored'
);

-- Only the server may call it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c2"}', true);
select throws_ok($$
  select redeem_invite('demo-invite-odd-input-dddddd', '00000000-0000-0000-0000-0000000000c2', 'Me', null)
$$, '42501', null, 'signed-in users can''t call redeem_invite themselves');

select * from finish();
rollback;
