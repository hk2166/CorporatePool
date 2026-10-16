-- Members add stops (F-G6 widened): the stop list no longer has to be filled by an admin before
-- anyone can use the app. Any member can add the stop where they get in or out: a name and a
-- point (their current location, or coordinates from a map). A stop with the same name, or
-- one within 150 m, is reused instead of duplicated. Admins still rename, merge and delete
-- (T-7.3).

alter table public.places
  add column created_by uuid references public.users (id) on delete set null;

create function public.add_place(p_name text, p_lat double precision, p_lng double precision)
returns table (place_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_point extensions.geography;
  v_id uuid;
begin
  if v_user is null or not exists (
    select 1 from public.users u where u.id = v_user and u.removed_at is null
  ) then
    raise exception 'Members only' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'A name of 2 to 80 characters' using errcode = '22023', hint = 'BAD_NAME';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'Not a place on the map' using errcode = '22023', hint = 'BAD_POINT';
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  -- Already there under that name, or something within 150 m: use it.
  select p.id into v_id from public.places p where lower(p.name) = lower(v_name) limit 1;
  if v_id is null then
    select p.id into v_id from public.places p
     where extensions.st_dwithin(p.geo, v_point, 150)
     order by extensions.st_distance(p.geo, v_point)
     limit 1;
  end if;
  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  insert into public.places (name, kind, geo, created_by)
  values (v_name, 'landmark', v_point, v_user)
  returning id into v_id;
  return query select v_id, true;
end
$$;

revoke execute on function public.add_place(text, double precision, double precision) from public, anon;
grant execute on function public.add_place(text, double precision, double precision) to authenticated;
