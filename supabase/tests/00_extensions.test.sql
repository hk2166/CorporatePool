-- Checks the database has what the schema migrations build on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_extension('postgis', 'PostGIS is installed');
select is(
  (select n.nspname::text
     from pg_extension e
     join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'postgis'),
  'extensions',
  'PostGIS lives in the extensions schema, not public'
);
-- users.id references auth.users, so the auth schema must exist even when only the database
-- container runs (CI starts nothing else).
select has_table('auth', 'users', 'auth.users exists');
-- 2 km proximity, the core of search (lld.md §1): two points ~1.1 km apart.
select ok(
  extensions.st_dwithin(
    extensions.st_makepoint(77.3260, 28.1440)::extensions.geography,
    extensions.st_makepoint(77.3260, 28.1540)::extensions.geography,
    2000
  ),
  'PostGIS distance check works on geography points'
);

select * from finish();
rollback;
