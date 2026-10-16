-- list_places() (T-3.1): the stop list in route order with plain coordinates.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into places (id, name, geo) values
  ('10000000-0000-0000-0000-0000000000b1', 'Demo North Stop',
   extensions.st_makepoint(77.0800, 28.9000)::extensions.geography),
  ('10000000-0000-0000-0000-0000000000b2', 'Demo South Stop',
   extensions.st_makepoint(77.3300, 27.9500)::extensions.geography);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000099"}', true);

select is(
  (select array_agg(name order by ord) from (
     select name, row_number() over () as ord from list_places()
   ) l where name in ('Demo North Stop', 'Demo South Stop')),
  array['Demo South Stop', 'Demo North Stop'],
  'stops come south to north (route order)'
);
select is(
  (select round(lat::numeric, 4) || ',' || round(lng::numeric, 4)
     from list_places() where name = 'Demo North Stop'),
  '28.9000,77.0800',
  'each stop has plain latitude and longitude'
);
select is(
  (select count(*) from list_places()),
  (select count(*) from places),
  'every stop is listed'
);

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from list_places() $$, '42501', null,
  'visitors who aren''t signed in can''t list stops');

select * from finish();
rollback;
