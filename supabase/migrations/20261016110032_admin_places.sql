-- Managing the stop list (T-7.3, F-G6): admins add, rename and move stops, and merge
-- duplicates ("Palwal Bus Stand" and "Palwal bus stand"). Both functions check the caller is
-- an admin; deleting a stop uses the existing "Admins manage places" access rule.

-- Adds a stop, or changes one when p_id is given. Returns its id.
create function public.admin_save_place(
  p_id uuid,
  p_name text,
  p_kind public.place_kind,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_geo extensions.geography := extensions.st_setsrid(
    extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Not a place on the map' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.places (name, kind, geo) values (btrim(p_name), p_kind, v_geo)
    returning id into v_id;
  else
    update public.places set name = btrim(p_name), kind = p_kind, geo = v_geo
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'No such stop' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end
$$;

-- Merges p_from into p_into: everything that pointed at p_from (members' home and work stops,
-- usual rides, rides still to come) points at p_into and takes its name, and p_from is
-- deleted. Rides that already happened keep the name they had. Returns how many references
-- moved.
create function public.admin_merge_places(p_from uuid, p_into uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_into public.places;
  v_moved integer := 0;
  v_n integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_into from public.places where id = p_into;
  if not found or p_from = p_into
     or not exists (select 1 from public.places where id = p_from) then
    raise exception 'Pick two different stops' using errcode = 'P0001', hint = 'BAD_MERGE';
  end if;

  update public.users set home_place_id = p_into where home_place_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;
  update public.users set work_place_id = p_into where work_place_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  -- Usual rides keep their stops as JSON: rewrite the entries that name p_from.
  update public.usual_rides u
     set stops = (
       select jsonb_agg(
                case when e.stop ->> 'place_id' = p_from::text
                     then e.stop || jsonb_build_object('place_id', p_into, 'label', v_into.name,
                                                       'lat', extensions.st_y(v_into.geo::extensions.geometry),
                                                       'lng', extensions.st_x(v_into.geo::extensions.geometry))
                     else e.stop end
                order by e.ord)
         from jsonb_array_elements(u.stops) with ordinality as e(stop, ord)
     ),
         updated_at = now()
   where exists (
     select 1 from jsonb_array_elements(u.stops) s where s ->> 'place_id' = p_from::text
   );
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  update public.ride_stops s
     set place_id = p_into,
         label = case when r.depart_at > now() then v_into.name else s.label end,
         geo = case when r.depart_at > now() then v_into.geo else s.geo end
    from public.rides r
   where r.id = s.ride_id and s.place_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  update public.places set use_count = use_count
         + (select p.use_count from public.places p where p.id = p_from)
   where id = p_into;
  delete from public.places where id = p_from;
  return v_moved;
end
$$;

revoke execute on function public.admin_save_place(uuid, text, public.place_kind, double precision, double precision) from public, anon;
revoke execute on function public.admin_merge_places(uuid, uuid) from public, anon;
grant execute on function public.admin_save_place(uuid, text, public.place_kind, double precision, double precision) to authenticated;
grant execute on function public.admin_merge_places(uuid, uuid) to authenticated;
