-- Access rules for users, blocks, push_subscriptions and signup_tokens (T-1.3, part 2).
-- Each block signs in as one person and checks what they can and can't do.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Fixtures, as the database owner (all fake). Owner O has a ride; R has a confirmed booking on
-- it; Q only requested one; S is a stranger; A is an admin.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'demo.owner@example.com'),
  ('00000000-0000-0000-0000-0000000000a1', 'demo.rider@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'demo.requester@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'demo.stranger@example.com'),
  ('00000000-0000-0000-0000-0000000000a4', 'demo.admin@example.com');
insert into users (id, name, phone, upi_vpa, is_admin) values
  ('00000000-0000-0000-0000-0000000000a0', 'Demo Owner', '+910000000040', 'demo.owner@okdemo', false),
  ('00000000-0000-0000-0000-0000000000a1', 'Demo Rider', '+910000000041', null, false),
  ('00000000-0000-0000-0000-0000000000a2', 'Demo Requester', '+910000000042', null, false),
  ('00000000-0000-0000-0000-0000000000a3', 'Demo Stranger', null, null, false),
  ('00000000-0000-0000-0000-0000000000a4', 'Demo Admin', '+910000000044', null, true);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a0',
   'Demo Hatchback', 'White', 'HR26DM0040', 4);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a0',
   '20000000-0000-0000-0000-0000000000a0',
   '2026-10-20 08:00+05:30', '2026-10-19 22:00+05:30', 3, 2, 150);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
  ('40000000-0000-0000-0000-0000000000a0', 0,
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
  ('40000000-0000-0000-0000-0000000000a0', 1,
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70);
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('40000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a1', 0, 1,
   'CONFIRMED', now());
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq) values
  ('40000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-0000000000a2', 0, 1);
insert into signup_tokens (token, created_by, expires_at) values
  ('demo-token-pppppppppppppppp', '00000000-0000-0000-0000-0000000000a4', now() + interval '7 days');

set local role authenticated;

-- A stranger --------------------------------------------------------------------------------- 13

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3"}', true);

select is(
  (select name from users where id = '00000000-0000-0000-0000-0000000000a0'),
  'Demo Owner',
  'stranger: sees members'' names'
);
select throws_ok($$ select phone from users $$, '42501', null, 'stranger: can''t read phone numbers');
select throws_ok($$ select reliability_score from users $$, '42501', null,
  'stranger: can''t read scores');
select is(
  (select count(*) from get_contact('00000000-0000-0000-0000-0000000000a0')),
  0::bigint,
  'stranger: get_contact gives nothing without a confirmed booking'
);
select is(
  (select count(*) from get_reliability('00000000-0000-0000-0000-0000000000a0')),
  0::bigint,
  'stranger: can''t see someone else''s score'
);
select lives_ok($$
  update users set phone = '+910000000043' where id = '00000000-0000-0000-0000-0000000000a3'
$$, 'stranger: can add their own phone number');
select lives_ok($$
  update users set name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000a0'
$$, 'stranger: editing someone else''s profile silently changes nothing…');
select is(
  (select name from users where id = '00000000-0000-0000-0000-0000000000a0'),
  'Demo Owner',
  '…the name is unchanged'
);
select throws_ok($$
  update users set is_admin = true where id = '00000000-0000-0000-0000-0000000000a3'
$$, '42501', null, 'stranger: can''t make themselves an admin');
select throws_ok($$
  update users set reliability_score = 100 where id = '00000000-0000-0000-0000-0000000000a3'
$$, '42501', null, 'stranger: can''t change their own score');
select throws_ok($$
  insert into users (id, name) values ('00000000-0000-0000-0000-0000000000a3', 'Demo Again')
$$, '42501', null, 'stranger: can''t create profiles (the server does, after the invite check)');
select throws_ok($$
  delete from users where id = '00000000-0000-0000-0000-0000000000a3'
$$, '42501', null, 'stranger: can''t delete profiles directly (T-2.4 does it on the server)');
select is(
  (select phone from get_my_profile()),
  '+910000000043',
  'stranger: get_my_profile returns their own private fields'
);

-- The rider with a confirmed booking ---------------------------------------------------------- 3

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1"}', true);

select is(
  (select phone from get_contact('00000000-0000-0000-0000-0000000000a0')),
  '+910000000040',
  'confirmed rider: gets the owner''s phone (WhatsApp button)'
);
select is(
  (select upi_vpa from get_contact('00000000-0000-0000-0000-0000000000a0')),
  'demo.owner@okdemo',
  'confirmed rider: gets the owner''s UPI ID (Pay by UPI button)'
);
select is(
  (select count(*) from get_contact('00000000-0000-0000-0000-0000000000a3')),
  0::bigint,
  'confirmed rider: still gets nothing for unrelated people'
);

-- The owner ----------------------------------------------------------------------------------- 3

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a0"}', true);

select is(
  (select phone from get_contact('00000000-0000-0000-0000-0000000000a1')),
  '+910000000041',
  'owner: gets a confirmed rider''s phone'
);
select is(
  (select count(*) from get_contact('00000000-0000-0000-0000-0000000000a2')),
  0::bigint,
  'owner: gets nothing for someone who only requested a seat'
);
select is(
  (select count(*) from get_reliability('00000000-0000-0000-0000-0000000000a1')),
  0::bigint,
  'owner: can''t see a rider''s score (only the rider and admins can)'
);

-- An admin ------------------------------------------------------------------------------------ 4

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a4"}', true);

select is(
  (select reliability_score from get_reliability('00000000-0000-0000-0000-0000000000a1')),
  50::smallint,
  'admin: can see anyone''s score'
);
select is(
  (select count(*) from get_contact('00000000-0000-0000-0000-0000000000a1')),
  1::bigint,
  'admin: can see contact details (for moderation)'
);
select is((select count(*) from signup_tokens), 1::bigint, 'admin: can see invites');
select throws_ok($$
  insert into signup_tokens (token, created_by, expires_at) values
    ('demo-token-qqqqqqqqqqqqqqqq', '00000000-0000-0000-0000-0000000000a4', now() + interval '1 day')
$$, '42501', null, 'admin: invites are created by the server, not directly');

-- blocks ------------------------------------------------------------------------------------- 4

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3"}', true);
select lives_ok($$
  insert into blocks (blocker_id, blocked_id) values
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a0')
$$, 'stranger: can block someone');
select is((select count(*) from blocks), 1::bigint, 'stranger: sees their own block');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a0"}', true);
select is((select count(*) from blocks), 0::bigint, 'owner: can''t see that they were blocked');
select throws_ok($$
  insert into blocks (blocker_id, blocked_id) values
    ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1')
$$, '42501', null, 'owner: can''t create a block in someone else''s name');

-- push_subscriptions ------------------------------------------------------------------------- 3

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3"}', true);
select lives_ok($$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('https://fcm.googleapis.com/fcm/send/demo-1', '00000000-0000-0000-0000-0000000000a3',
     repeat('B', 87), repeat('a', 22))
$$, 'stranger: can register their own browser');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a0"}', true);
select is((select count(*) from push_subscriptions), 0::bigint,
  'owner: can''t see other people''s subscriptions');
select throws_ok($$
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
    ('https://fcm.googleapis.com/fcm/send/demo-2', '00000000-0000-0000-0000-0000000000a3',
     repeat('B', 87), repeat('a', 22))
$$, '42501', null, 'owner: can''t register a browser for someone else');

-- A visitor who isn't signed in ---------------------------------------------------------------- 3

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select throws_ok($$ select name from users $$, '42501', null, 'visitor: can''t read members');
select throws_ok($$ select * from get_my_profile() $$, '42501', null,
  'visitor: can''t call get_my_profile');
select throws_ok($$ select count(*) from signup_tokens $$, '42501', null,
  'visitor: can''t read invites');

-- Once the ride is over, contact details are private again ------------------------------------ 1

reset role;
update rides set status = 'COMPLETED' where id = '40000000-0000-0000-0000-0000000000a0';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1"}', true);

select is(
  (select count(*) from get_contact('00000000-0000-0000-0000-0000000000a0')),
  0::bigint,
  'rider: after the ride is completed, the owner''s phone is private again'
);

select * from finish();
rollback;
