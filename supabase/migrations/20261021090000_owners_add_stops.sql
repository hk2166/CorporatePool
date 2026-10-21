-- Car owners add stops themselves, straight from the pickup and drop lists of their rides: a
-- name and where it is (a Google Maps link, read on the server, or the owner's current
-- location). The stop is in everyone's list at once. Members who don't drive still ask an
-- admin (request_stop), and admins still rename, move and delete any stop.
--
-- A stop of the same name, or one within 150 m, is reused instead of duplicated. A point more
-- than 60 km from every stop is refused: it's almost certainly a wrong link. At most 10 new
-- stops a day each. places.created_by (20261016155747_member_stops.sql) records who added it.

create function public.owner_add_place(p_name text, p_lat double precision, p_lng double precision)
returns table (place_id uuid, place_name text, lat double precision, lng double precision, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_name text := btrim(coalesce(p_name, ''));
  v_point extensions.geography;
  v_found public.places;
  v_id uuid;
begin
  if not exists (
    select 1 from public.users u where u.id = v_uid and u.ride_preference in ('DRIVER', 'BOTH')
  ) then
    raise exception 'Car owners only' using errcode = '42501', hint = 'NOT_OWNER';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'Name must be 2 to 80 characters' using errcode = '22023', hint = 'BAD_NAME';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'Not a place on the map' using errcode = '22023', hint = 'BAD_POINT';
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  -- Already there under that name, or something within 150 m: use that stop.
  select p.* into v_found from public.places p where lower(p.name) = lower(v_name) limit 1;
  if v_found.id is null then
    select p.* into v_found from public.places p
     where extensions.st_dwithin(p.geo, v_point, 150)
     order by extensions.st_distance(p.geo, v_point)
     limit 1;
  end if;
  if v_found.id is not null then
    return query select v_found.id, v_found.name,
      extensions.st_y(v_found.geo::extensions.geometry), extensions.st_x(v_found.geo::extensions.geometry),
      false;
    return;
  end if;

  if exists (select 1 from public.places)
     and not exists (select 1 from public.places p where extensions.st_dwithin(p.geo, v_point, 60000)) then
    raise exception 'Far from every stop' using errcode = '22023', hint = 'TOO_FAR';
  end if;
  if (select count(*) from public.places p
       where p.created_by = v_uid and p.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Ten new stops a day' using errcode = '22023', hint = 'TOO_MANY';
  end if;

  insert into public.places (name, kind, geo, created_by)
  values (v_name, 'landmark', v_point, v_uid)
  returning id into v_id;
  return query select v_id, v_name, p_lat, p_lng, true;
end
$$;

revoke execute on function public.owner_add_place(text, double precision, double precision) from public, anon;
grant execute on function public.owner_add_place(text, double precision, double precision) to authenticated;
