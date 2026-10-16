-- Ride preference: riding, driving or both, set by each member for themselves.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001601', 'demo.pref.one@example.com'),
  ('00000000-0000-0000-0000-000000001602', 'demo.pref.two@example.com');
insert into users (id, name) values
  ('00000000-0000-0000-0000-000000001601', 'Demo Pref One'),
  ('00000000-0000-0000-0000-000000001602', 'Demo Pref Two');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001601"}', true);

select is((select ride_preference from get_my_profile()), null, 'new members haven''t answered yet');

update users set ride_preference = 'DRIVER' where id = '00000000-0000-0000-0000-000000001601';
select is((select ride_preference from get_my_profile()), 'DRIVER', 'members set their own');

select throws_ok(
  $$ update users set ride_preference = 'PILOT' where id = '00000000-0000-0000-0000-000000001601' $$,
  '23514', null, 'only riding, driving or both');

-- Someone else's row: the access rules leave it alone.
update users set ride_preference = 'RIDER' where id = '00000000-0000-0000-0000-000000001602';
reset role;
select is((select ride_preference from users where id = '00000000-0000-0000-0000-000000001602'), null,
  'nobody sets anyone else''s');

set local role authenticated;
select throws_ok($$ select ride_preference from users $$, '42501', null,
  'and nobody reads anyone else''s: only get_my_profile shows it');

select * from finish();
rollback;
