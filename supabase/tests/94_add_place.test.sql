-- Members add stops (add_place).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001201', 'demo.addplace@example.com'),
  ('00000000-0000-0000-0000-000000001202', 'demo.addplace.removed@example.com');
insert into users (id, name, phone, removed_at) values
  ('00000000-0000-0000-0000-000000001201', 'Demo Member', '+919999981201', null),
  ('00000000-0000-0000-0000-000000001202', 'Demo Removed', '+919999981202', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001201"}', true);

create temporary table added on commit drop as
select * from add_place('  Demo Clock Tower  ', 12.97160, 77.59460);
grant select on added to authenticated;

select is((select created from added), true, 'a member adds a stop');
select is((select name || ' ' || kind || ' ' || (created_by is not null)::text from places where id = (select place_id from added)),
  'Demo Clock Tower landmark true', 'trimmed, a landmark, and it records who added it');
select is((select place_id from add_place('demo clock tower', 12.9800, 77.6000)), (select place_id from added),
  'the same name again reuses it');
select is((select place_id || ' ' || created from add_place('Demo Clock Tower Gate', 12.97170, 77.59470)),
  (select place_id from added) || ' false', 'a stop within 150 m reuses it too');
select is((select created from add_place('Demo Far Stop', 12.99000, 77.62000)), true,
  'a stop further away is new');
select throws_ok($$ select * from add_place('X', 12.9, 77.6) $$, '22023', 'A name of 2 to 80 characters',
  'a name is needed');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000001202"}', true);
select throws_ok($$ select * from add_place('Demo Sneaky', 12.9, 77.6) $$, '42501', 'Members only',
  'a removed member can''t add stops');
set local role anon;
select throws_ok($$ select * from add_place('Demo Visitor', 12.9, 77.6) $$, '42501', null,
  'nor can visitors');

select * from finish();
rollback;
