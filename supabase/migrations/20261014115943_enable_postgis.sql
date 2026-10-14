-- PostGIS: stores stop locations as geography points and answers "is there a stop within
-- 2 km of me?" (lld.md §1). Installed in the `extensions` schema, as Supabase recommends, so
-- its functions don't clutter `public`, which the API exposes.
create extension if not exists postgis with schema extensions;
