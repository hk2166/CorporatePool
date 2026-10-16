-- Stop requests: members ask for a stop, admins add it (replacing members adding stops
-- themselves, 20261016155747_member_stops.sql). A request has a name, and optionally where it
-- is: a Google Maps link and the position read from it (the server reads links, including
-- maps.app.goo.gl short links, in lib/resolve-location.ts). Admins add a request as a stop,
-- with the position fixed if needed, or turn it down. Admins add stops directly as before
-- (admin_save_place), now also from a Google Maps link.

create table public.stop_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.users (id) on delete set null,
  name text not null check (name = btrim(name) and char_length(name) between 2 and 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  maps_link text check (maps_link is null or (char_length(maps_link) <= 500 and maps_link ~ '^https?://')),
  status text not null default 'PENDING' check (status in ('PENDING', 'ADDED', 'REJECTED')),
  place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.users (id) on delete set null,
  check ((lat is null) = (lng is null))
);

create index stop_requests_pending_idx on public.stop_requests (created_at)
  where status = 'PENDING';
create index stop_requests_requested_by_idx on public.stop_requests (requested_by);

-- People see their own requests; admins see them all. Writes go through the functions below.
alter table public.stop_requests enable row level security;
revoke all on public.stop_requests from anon, authenticated;
grant select on public.stop_requests to authenticated;

create policy "People see their own stop requests"
  on public.stop_requests for select to authenticated
  using (requested_by = (select auth.uid()));

create policy "Admins see all stop requests"
  on public.stop_requests for select to authenticated
  using ((select private.is_admin()));

-- Members no longer add stops directly.
drop function public.add_place(text, double precision, double precision);

-- ---------------------------------------------------------------------------------------------
-- Asking for a stop, as a member. The name is required; the position and link are optional
-- (both or neither for the position). A stop of that name already in the list is refused;
-- the same name already waiting is the same request (it takes the position if it had none).
-- At most 10 a day each.

create function public.request_stop(
  p_name text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_name text := btrim(coalesce(p_name, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_id uuid;
begin
  if char_length(v_name) not between 2 and 80 then
    raise exception 'Name must be 2 to 80 characters' using errcode = '22023', hint = 'BAD_NAME';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Not a place on the map' using errcode = '22023', hint = 'BAD_POINT';
  end if;
  if v_link is not null and (char_length(v_link) > 500 or v_link !~ '^https?://') then
    raise exception 'Not a web link' using errcode = '22023', hint = 'BAD_LINK';
  end if;
  if exists (select 1 from public.places p where lower(p.name) = lower(v_name)) then
    raise exception 'Already a stop' using errcode = '22023', hint = 'EXISTS';
  end if;

  select r.id into v_id from public.stop_requests r
   where r.status = 'PENDING' and lower(r.name) = lower(v_name)
   order by r.created_at limit 1;
  if v_id is not null then
    update public.stop_requests r
       set lat = p_lat, lng = p_lng, maps_link = coalesce(r.maps_link, v_link)
     where r.id = v_id and r.lat is null and p_lat is not null;
    return v_id;
  end if;

  if (select count(*) from public.stop_requests r
       where r.requested_by = v_uid and r.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many requests today' using errcode = '22023', hint = 'TOO_MANY';
  end if;

  insert into public.stop_requests (requested_by, name, lat, lng, maps_link)
  values (v_uid, v_name, p_lat, p_lng, v_link)
  returning id into v_id;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- An admin adds a waiting request as a stop, with the name, kind and position they settled on
-- (the request's own position may be missing or off). Returns the new stop. The stop records
-- who asked for it.

create function public.admin_add_stop_request(
  p_request_id uuid,
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
  v_request public.stop_requests;
  v_place uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_request from public.stop_requests r where r.id = p_request_id for update;
  if not found then
    raise exception 'No such request' using errcode = 'P0002';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Already decided' using errcode = '22023', hint = 'DECIDED';
  end if;

  v_place := public.admin_save_place(null, p_name, p_kind, p_lat, p_lng);
  update public.places p set created_by = v_request.requested_by where p.id = v_place;
  update public.stop_requests r
     set status = 'ADDED', place_id = v_place, decided_at = now(), decided_by = (select auth.uid())
   where r.id = p_request_id;
  return v_place;
end
$$;

create function public.admin_reject_stop_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.stop_requests r
     set status = 'REJECTED', decided_at = now(), decided_by = (select auth.uid())
   where r.id = p_request_id and r.status = 'PENDING';
  if not found then
    raise exception 'No such waiting request' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function public.request_stop(text, double precision, double precision, text) from public, anon;
revoke execute on function public.admin_add_stop_request(uuid, text, public.place_kind, double precision, double precision) from public, anon;
revoke execute on function public.admin_reject_stop_request(uuid) from public, anon;
grant execute on function public.request_stop(text, double precision, double precision, text) to authenticated;
grant execute on function public.admin_add_stop_request(uuid, text, public.place_kind, double precision, double precision) to authenticated;
grant execute on function public.admin_reject_stop_request(uuid) to authenticated;
