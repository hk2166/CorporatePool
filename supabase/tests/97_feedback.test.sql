-- Feedback: members send ideas and problems and upvote them; admins mark and reply.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Admin A, members M1 and M2, and R, who was removed.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001501', 'demo.fb.admin@example.com'),
  ('00000000-0000-0000-0000-000000001502', 'demo.fb.one@example.com'),
  ('00000000-0000-0000-0000-000000001503', 'demo.fb.two@example.com'),
  ('00000000-0000-0000-0000-000000001504', 'demo.fb.removed@example.com');
insert into users (id, name, is_admin, removed_at) values
  ('00000000-0000-0000-0000-000000001501', 'Demo Feedback Admin', true, null),
  ('00000000-0000-0000-0000-000000001502', 'Demo Feedback One', false, null),
  ('00000000-0000-0000-0000-000000001503', 'Demo Feedback Two', false, null),
  ('00000000-0000-0000-0000-000000001504', 'Demo Feedback Removed', false, now());

set local role authenticated;

-- Sending ------------------------------------------------------------------------------------ 5

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001502"}', true);
select lives_ok($$ select submit_feedback('IDEA', '  Demo: evening rides home  ', 'Most of us leave at 18:00.') $$,
  'a member sends an idea');
select results_eq(
  $$ select title, details, status, votes, voted, mine, author_name from list_feedback() $$,
  $$ values ('Demo: evening rides home'::text, 'Most of us leave at 18:00.'::text, 'OPEN'::text,
             1, true, true, null::text) $$,
  'it comes with their own vote, and members don''t see names, even their own');
select throws_ok($$ select submit_feedback('RANT', 'Demo title', null) $$, '22023', 'Idea or problem?',
  'it''s an idea or a problem');
select throws_ok($$ select submit_feedback('IDEA', 'no', null) $$, '22023', 'Title must be 3 to 120 characters',
  'with a real title');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001503"}', true);
select submit_feedback('PROBLEM', 'Demo problem ' || g, null) from generate_series(1, 10) as g;
select throws_ok($$ select submit_feedback('PROBLEM', 'Demo problem 11', null) $$, '22023', 'Too much feedback today',
  'at most 10 a day each');

-- Voting ------------------------------------------------------------------------------------- 5

select results_eq(
  $$ select votes, voted, mine from list_feedback() where title = 'Demo: evening rides home' $$,
  $$ values (1, false, false) $$,
  'another member sees the idea and its vote');
select is(vote_feedback((select id from list_feedback() where title = 'Demo: evening rides home'), true), 2,
  'an upvote counts');
select is(vote_feedback((select id from list_feedback() where title = 'Demo: evening rides home'), true), 2,
  'a second tap doesn''t count twice');
select is(vote_feedback((select id from list_feedback() where title = 'Demo: evening rides home'), false), 1,
  'and the vote can be taken back');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001504"}', true);
select throws_ok($$ select * from list_feedback() $$, '42501', 'Members only', 'removed members see nothing');

-- The admin ---------------------------------------------------------------------------------- 7

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001501"}', true);
select results_eq(
  $$ select author_id, author_name from list_feedback() where title = 'Demo: evening rides home' $$,
  $$ values ('00000000-0000-0000-0000-000000001502'::uuid, 'Demo Feedback One'::text) $$,
  'admins see who wrote it');
select throws_ok($$ select admin_update_feedback('00000000-0000-0000-0000-000000001501',
  (select id from list_feedback() where title = 'Demo: evening rides home'), 'DONE', null) $$,
  '42501', null, 'nobody signed in can call the admin update directly');
reset role;

select throws_ok($$ select admin_update_feedback('00000000-0000-0000-0000-000000001502',
  (select id from feedback where title = 'Demo: evening rides home'), 'DONE', null) $$,
  '42501', 'Admins only', 'members can''t mark feedback');
select throws_ok($$ select admin_update_feedback('00000000-0000-0000-0000-000000001501',
  (select id from feedback where title = 'Demo: evening rides home'), 'MAYBE', null) $$,
  '22023', 'Unknown status', 'only the known statuses');
select admin_update_feedback('00000000-0000-0000-0000-000000001501',
  (select id from feedback where title = 'Demo: evening rides home'), 'DONE', '  Live from Monday.  ');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001503"}', true);
select results_eq(
  $$ select status, admin_reply from list_feedback() where title = 'Demo: evening rides home' $$,
  $$ values ('DONE'::text, 'Live from Monday.'::text) $$,
  'everyone sees the status and the reply');
select throws_ok($$ select vote_feedback((select id from list_feedback() where title = 'Demo: evening rides home'), true) $$,
  '22023', 'Voting has closed', 'done items take no more votes');
select is((select count(*) from list_feedback()), 11::bigint, 'and everything is listed');

select * from finish();
rollback;
