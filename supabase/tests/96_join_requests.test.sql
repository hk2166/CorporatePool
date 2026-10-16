-- Join requests: asking to join without an invite, and an admin accepting or rejecting.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Admin A and member M; S and T signed in with Google but aren't members.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000001401', 'demo.join.admin@example.com', '{}'),
  ('00000000-0000-0000-0000-000000001402', 'demo.join.member@example.com', '{}'),
  ('00000000-0000-0000-0000-000000001403', 'demo.join.stranger@example.com',
   '{"full_name": "Demo Join Stranger", "avatar_url": "https://example.com/s.png"}'),
  ('00000000-0000-0000-0000-000000001404', 'demo.join.other@example.com',
   '{"avatar_url": "javascript:alert(1)"}');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-000000001401', 'Demo Join Admin', true),
  ('00000000-0000-0000-0000-000000001402', 'Demo Join Member', false);

set local role authenticated;

-- Asking ------------------------------------------------------------------------------------ 7

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001403"}', true);
select lives_ok($$ select request_to_join('I work at the demo office') $$, 'someone without an invite can ask');
select results_eq(
  $$ select name, email, photo_url, note, status from join_requests $$,
  $$ values ('Demo Join Stranger'::text, 'demo.join.stranger@example.com'::text,
             'https://example.com/s.png'::text, 'I work at the demo office'::text, 'PENDING'::text) $$,
  'their name, email and photo come from their Google account, and they see their own request');
select request_to_join('  Mornings from the demo stop  ');
select results_eq($$ select count(*), max(note) from join_requests $$,
  $$ values (1::bigint, 'Mornings from the demo stop'::text) $$,
  'asking again only updates the note');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001404"}', true);
select is((select count(*) from join_requests), 0::bigint, 'nobody sees anyone else''s request');
select request_to_join(null);
select results_eq($$ select name, photo_url from join_requests $$,
  $$ values ('demo.join.other'::text, null::text) $$,
  'without a Google name the email is used, and a photo that isn''t a web address is dropped');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001402"}', true);
select throws_ok($$ select request_to_join('hi') $$, '22023', 'Already a member', 'members don''t need to ask');
select throws_ok($$ select admin_decide_join_request('00000000-0000-0000-0000-000000001401',
  '00000000-0000-0000-0000-000000001403', true) $$, '42501', null,
  'and nobody signed in can call the admin decision directly');

-- The admin sees and decides ---------------------------------------------------------------- 8

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001401"}', true);
select is((select count(*) from join_requests where status = 'PENDING'), 2::bigint, 'the admin sees every request');
reset role;

select throws_ok($$ select admin_decide_join_request('00000000-0000-0000-0000-000000001402',
  '00000000-0000-0000-0000-000000001403', true) $$, '42501', 'Admins only', 'a member can''t decide');

select admin_decide_join_request('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001403', true);
select results_eq(
  $$ select name, photo_url, is_admin, removed_at is null from users where id = '00000000-0000-0000-0000-000000001403' $$,
  $$ values ('Demo Join Stranger'::text, 'https://example.com/s.png'::text, false, true) $$,
  'accepting makes them a member');
select results_eq(
  $$ select status, decided_by from join_requests where user_id = '00000000-0000-0000-0000-000000001403' $$,
  $$ values ('ACCEPTED'::text, '00000000-0000-0000-0000-000000001401'::uuid) $$,
  'and records who accepted');
select throws_ok($$ select admin_decide_join_request('00000000-0000-0000-0000-000000001401',
  '00000000-0000-0000-0000-000000001403', false) $$, '22023', 'Already accepted',
  'an accepted request can''t be rejected (remove the member instead)');

select admin_decide_join_request('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001404', false);
select is((select count(*) from users where id = '00000000-0000-0000-0000-000000001404'), 0::bigint,
  'rejecting doesn''t make them a member');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001404"}', true);
select throws_ok($$ select request_to_join('please') $$, '22023', 'Request declined',
  'once rejected, asking again doesn''t work');
reset role;

-- A mistaken rejection can still be accepted.
select admin_decide_join_request('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001404', true);
select is((select count(*) from users where id = '00000000-0000-0000-0000-000000001404'), 1::bigint,
  'a rejected request can still be accepted');

select * from finish();
rollback;
