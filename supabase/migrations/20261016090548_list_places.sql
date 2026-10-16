-- The stop list in route order, with plain coordinates (T-3.1).
--
-- The API returns geography columns as an encoded blob, so pages read stops through this
-- instead: id, name, kind, latitude and longitude. Ordered south to north, which along the
-- Palwal → Gurgaon corridor is the order people travel, so lists read like the route.
-- Security invoker: the places access rule (signed-in users only, T-1.3) still applies.
create function public.list_places()
returns table (
  id uuid,
  name text,
  kind public.place_kind,
  lat double precision,
  lng double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id,
         p.name,
         p.kind,
         extensions.st_y(p.geo::extensions.geometry),
         extensions.st_x(p.geo::extensions.geometry)
    from public.places p
   order by extensions.st_y(p.geo::extensions.geometry), p.name
$$;

revoke execute on function public.list_places() from public, anon;
grant execute on function public.list_places() to authenticated;
