-- Hudda Sector Cut, Palwal: a pickup point on the way out of Palwal. Position from the Google
-- Maps link the group's admin shared (16 Oct 2026), https://maps.app.goo.gl/gckhaEaM8exobJ9F7,
-- which points at 28.146986, 77.313914. Skipped if a stop of that name is already there.

insert into public.places (name, kind, geo)
select 'Hudda Sector Cut', 'landmark',
       extensions.st_setsrid(extensions.st_makepoint(77.313914, 28.146986), 4326)::extensions.geography
 where not exists (select 1 from public.places p where lower(p.name) = 'hudda sector cut')
on conflict (name) do nothing;
