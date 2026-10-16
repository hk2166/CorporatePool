-- Agra Chowk, Palwal: where nearly every morning ride to Gurugram starts and every evening
-- ride ends. The map doesn't have it (20261016174411_common_stops.sql), so the position is
-- the one the group's admin gave (16 Oct 2026). Skipped if a stop of that name is already there.

insert into public.places (name, kind, geo)
select 'Agra Chowk', 'landmark',
       extensions.st_setsrid(extensions.st_makepoint(77.32900, 28.14400), 4326)::extensions.geography
 where not exists (select 1 from public.places p where lower(p.name) = 'agra chowk')
on conflict (name) do nothing;
