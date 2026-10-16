-- Whole-schema guards (T-1.2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- The data model in docs/lld.md, exactly. When a task adds a table, add it here too.
select tables_are(
  'public',
  array[
    'places', 'users', 'cars', 'signup_tokens', 'blocks',
    'usual_rides', 'usual_ride_skips', 'rides', 'ride_stops',
    'bookings', 'reliability_events', 'reviews',
    'reports', 'admin_actions', 'push_subscriptions', 'notifications_outbox', 'member_activity',
    'join_requests'
  ],
  'public has exactly the tables of the data model'
);

-- A table without RLS is readable and writable by anyone through the public API, so no table
-- in public may ever be created without it.
select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and not c.relrowsecurity),
  null,
  'every table in public has Row-Level Security on'
);

-- Visitors who aren't signed in reach the database only through functions granted to them
-- (get_public_ride). Supabase grants new tables to `anon` by default, so every migration that
-- creates a table must revoke it (T-1.3).
select is(
  (select array_agg(distinct g.table_name::text order by g.table_name::text)
     from information_schema.role_table_grants g
    where g.grantee = 'anon' and g.table_schema = 'public'),
  null,
  'anon has no privileges on any table in public'
);

-- A SECURITY DEFINER function runs with its owner's rights. Without a fixed search_path,
-- whoever calls it could make it pick up their own lookalike tables or functions.
select is(
  (select array_agg(p.proname::text order by p.proname::text)
     from pg_proc p
    where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as c(setting)
         where c.setting like 'search_path=%'
      )),
  null,
  'every SECURITY DEFINER function pins its search_path'
);

-- Realtime streams row changes to browsers (T-4.3). Each published table is a deliberate
-- choice, so the list is pinned here.
select is(
  (select array_agg(t.tablename::text order by t.tablename::text)
     from pg_publication_tables t
    where t.pubname = 'supabase_realtime'),
  array['rides'],
  'Realtime publishes only rides'
);

select * from finish();
rollback;
