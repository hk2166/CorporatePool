-- Stop requests: members ask for a stop (name required, position optional); admins add or
-- turn them down. Members can't add stops directly any more.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001701', 'demo.sr.admin@example.com'),
  ('00000000-0000-0000-0000-000000001702', 'demo.sr.one@example.com'),
  ('00000000-0000-0000-0000-000000001703', 'demo.sr.two@example.com');
insert into users (id, name, is_admin) values
  ('00000000-0000-0000-0000-000000001701', 'Demo SR Admin', true),
  ('00000000-0000-0000-0000-000000001702', 'Demo SR One', false),
  ('00000000-0000-0000-0000-000000001703', 'Demo SR Two', false);
insert into places (name, geo) values
  ('Demo SR Existing', extensions.st_makepoint(77.25, 28.25)::extensions.geography);

select hasnt_function('public', 'add_place', array['text', 'double precision', 'double precision'],
  'members can''t add stops directly any more');

set local role authenticated;

-- A member asks ----------------------------------------------------------------------------- 7

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001702"}', true);
select lives_ok(
  $$ select request_stop('Demo SR Pin', 28.146986, 77.313914, 'https://maps.app.goo.gl/demo') $$,
  'a member asks for a stop with its Google Maps link and position');
select results_eq(
  $$ select name, lat, lng, maps_link, status from stop_requests where name = 'Demo SR Pin' $$,
  $$ values ('Demo SR Pin'::text, 28.146986::double precision, 77.313914::double precision,
             'https://maps.app.goo.gl/demo'::text, 'PENDING'::text) $$,
  'and sees it waiting');
select lives_ok($$ select request_stop('  Demo SR Name Only  ') $$, 'the position is optional');
select throws_ok($$ select request_stop(' x ') $$, '22023', 'Name must be 2 to 80 characters',
  'the name is not');
select throws_ok($$ select request_stop('Demo SR Half', 28.1, null) $$, '22023', 'Not a place on the map',
  'a position needs both numbers');
select throws_ok($$ select request_stop('demo sr existing') $$, '22023', 'Already a stop',
  'a stop already in the list can''t be asked for');
select throws_ok($$ select request_stop('Demo SR Link', null, null, 'javascript:alert(1)') $$, '22023',
  'Not a web link', 'only web links are kept');

-- Another member -------------------------------------------------------------------------- 3

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001703"}', true);
select is((select count(*) from stop_requests), 0::bigint, 'members don''t see each other''s requests');
select lives_ok($$ select request_stop('demo sr name only', 28.2, 77.3) $$,
  'asking for the same stop again is fine');
select throws_ok($$ select admin_add_stop_request(gen_random_uuid(), 'X', 'landmark', 28.1, 77.3) $$,
  '42501', 'Admins only', 'members can''t add a request as a stop');

-- The admin ------------------------------------------------------------------------------- 5

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001701"}', true);
select results_eq(
  $$ select count(*), max(lat) from stop_requests where lower(name) = 'demo sr name only' $$,
  $$ values (1::bigint, 28.2::double precision) $$,
  'the same name is one request, which took the position it was missing');

select admin_add_stop_request((select id from stop_requests where name = 'Demo SR Pin'),
  'Demo SR Pin', 'landmark', 28.146986, 77.313914);
select results_eq(
  $$ select p.created_by, r.status from stop_requests r join places p on p.id = r.place_id
      where r.name = 'Demo SR Pin' $$,
  $$ values ('00000000-0000-0000-0000-000000001702'::uuid, 'ADDED'::text) $$,
  'adding a request makes the stop, credited to who asked');
select throws_ok(
  $$ select admin_add_stop_request((select id from stop_requests where name = 'Demo SR Pin'),
       'Demo SR Pin 2', 'landmark', 28.1, 77.3) $$,
  '22023', 'Already decided', 'a request is added once');

select admin_reject_stop_request((select id from stop_requests where name = 'Demo SR Name Only'));
select is((select status from stop_requests where name = 'Demo SR Name Only'), 'REJECTED',
  'or turned down');
select is((select count(*) from places where name = 'Demo SR Name Only'), 0::bigint,
  'and a turned-down request adds nothing');

select * from finish();
rollback;
