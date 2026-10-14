-- Whole-schema guards (T-1.2).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

-- The data model in docs/lld.md, exactly. When a task adds a table, add it here too.
select tables_are(
  'public',
  array[
    'places', 'users', 'cars', 'signup_tokens', 'blocks',
    'usual_rides', 'rides', 'ride_stops',
    'bookings', 'reliability_events', 'reviews',
    'reports', 'admin_actions', 'push_subscriptions', 'notifications_outbox'
  ],
  'public has exactly the 15 tables of the data model'
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

select * from finish();
rollback;
