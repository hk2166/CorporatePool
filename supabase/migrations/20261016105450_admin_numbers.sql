-- The admin's numbers (T-7.1): the rider ranking (F-G1) and occupancy (F-G2), "no cab goes
-- empty" measured. Both are for admins only and check that themselves.

-- Every member's reliability, best first: what a group admin eyeballs from memory today.
create function public.admin_rankings()
returns table (
  user_id uuid,
  name text,
  reliability_score smallint,
  rides_completed integer,
  no_shows_90d integer,
  late_cancels_90d integer,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select u.id, u.name, u.reliability_score, u.rides_completed, u.no_shows_90d,
         u.late_cancels_90d, u.created_at
    from public.users u
   order by u.reliability_score desc, u.rides_completed desc, u.name;
end
$$;

-- Seats offered and filled per day (in India) and route, for rides that weren't cancelled.
-- A seat counts as filled when a rider is confirmed in it, rode, or was a no-show (the seat
-- was taken either way).
create function public.admin_occupancy(p_from date, p_to date)
returns table (
  day date,
  route text,
  rides bigint,
  seats_offered bigint,
  seats_filled bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  with ride_routes as (
    select r.id,
           (r.depart_at at time zone 'Asia/Kolkata')::date as day,
           (select s.label from public.ride_stops s where s.ride_id = r.id order by s.seq limit 1)
           || ' → ' ||
           (select s.label from public.ride_stops s where s.ride_id = r.id order by s.seq desc limit 1)
             as route,
           r.seats_total
      from public.rides r
     where r.status <> 'CANCELLED'
       and (r.depart_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  )
  select rr.day, rr.route, count(*), sum(rr.seats_total)::bigint,
         coalesce(sum((select sum(b.seats) from public.bookings b
                         where b.ride_id = rr.id
                           and b.status in ('CONFIRMED', 'COMPLETED', 'NO_SHOW'))), 0)::bigint
    from ride_routes rr
   group by rr.day, rr.route
   order by rr.day desc, rr.route;
end
$$;

revoke execute on function public.admin_rankings() from public, anon;
revoke execute on function public.admin_occupancy(date, date) from public, anon;
grant execute on function public.admin_rankings() to authenticated;
grant execute on function public.admin_occupancy(date, date) to authenticated;
