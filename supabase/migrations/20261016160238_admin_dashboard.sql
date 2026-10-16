-- The admin dashboard (F-G1, F-G2 widened): who's using the app each day, how many rides and
-- seats, where people are going, and everything about each member. Every read function here
-- checks the caller is an admin.

-- ---------------------------------------------------------------------------------------------
-- Daily activity: one row per member per day (in India) they opened the app. Written by
-- record_visit() on every signed-in page (removed members aren't counted); nobody reads it
-- except the admin functions below. Only the date is kept, not times or pages.

create table public.member_activity (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

create index member_activity_day_idx on public.member_activity (day);

alter table public.member_activity enable row level security;
revoke all on public.member_activity from anon, authenticated;

create function public.record_visit()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.member_activity (user_id, day)
  select u.id, (now() at time zone 'Asia/Kolkata')::date
    from public.users u
   where u.id = (select auth.uid()) and u.removed_at is null
  on conflict do nothing
$$;

revoke execute on function public.record_visit() from public, anon;
grant execute on function public.record_visit() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The numbers at a glance.

create function public.admin_summary()
returns table (
  members integer,
  new_members_7d integer,
  active_today integer,
  active_7d integer,
  rides_today integer,
  rides_upcoming integer,
  seats_filled_today integer,
  requests_7d integer,
  stops integer,
  open_reports integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select
    (select count(*) from public.users u where u.removed_at is null)::integer,
    (select count(*) from public.users u
      where (u.created_at at time zone 'Asia/Kolkata')::date > v_today - 7)::integer,
    (select count(*) from public.member_activity a where a.day = v_today)::integer,
    (select count(distinct a.user_id) from public.member_activity a where a.day > v_today - 7)::integer,
    (select count(*) from public.rides r
      where r.status <> 'CANCELLED' and (r.depart_at at time zone 'Asia/Kolkata')::date = v_today)::integer,
    (select count(*) from public.rides r
      where r.status in ('OPEN', 'ALLOCATING', 'FULL') and r.depart_at > now())::integer,
    (select coalesce(sum(b.seats), 0) from public.bookings b join public.rides r on r.id = b.ride_id
      where r.status <> 'CANCELLED' and (r.depart_at at time zone 'Asia/Kolkata')::date = v_today
        and b.status in ('CONFIRMED', 'COMPLETED', 'NO_SHOW'))::integer,
    (select count(*) from public.bookings b
      where (b.created_at at time zone 'Asia/Kolkata')::date > v_today - 7)::integer,
    (select count(*) from public.places)::integer,
    (select count(*) from public.reports r where r.status = 'OPEN')::integer;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Day by day (in India): active members, new members, rides and seats on that day, and seat
-- requests made that day. Every day in the range has a row, quiet days included.

create function public.admin_daily_stats(p_from date, p_to date)
returns table (
  day date,
  active_members integer,
  new_members integer,
  rides integer,
  seats_offered integer,
  seats_filled integer,
  requests integer
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
  select d::date,
         (select count(*) from public.member_activity a where a.day = d::date)::integer,
         (select count(*) from public.users u
           where (u.created_at at time zone 'Asia/Kolkata')::date = d::date)::integer,
         (select count(*) from public.rides r
           where r.status <> 'CANCELLED' and (r.depart_at at time zone 'Asia/Kolkata')::date = d::date)::integer,
         (select coalesce(sum(r.seats_total), 0) from public.rides r
           where r.status <> 'CANCELLED' and (r.depart_at at time zone 'Asia/Kolkata')::date = d::date)::integer,
         (select coalesce(sum(b.seats), 0) from public.bookings b join public.rides r on r.id = b.ride_id
           where r.status <> 'CANCELLED' and (r.depart_at at time zone 'Asia/Kolkata')::date = d::date
             and b.status in ('CONFIRMED', 'COMPLETED', 'NO_SHOW'))::integer,
         (select count(*) from public.bookings b
           where (b.created_at at time zone 'Asia/Kolkata')::date = d::date)::integer
    from generate_series(p_from, p_to, interval '1 day') as d
   order by d desc;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Where people are going: the trips riders asked for (pickup stop → drop stop), most asked
-- first, and how many different riders take each.

create function public.admin_top_trips(p_from date, p_to date, p_limit integer default 10)
returns table (pickup text, dropoff text, trips integer, riders integer)
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
  select p.label, d.label, count(*)::integer, count(distinct b.rider_id)::integer
    from public.bookings b
    join public.rides r on r.id = b.ride_id
    join public.ride_stops p on p.ride_id = b.ride_id and p.seq = b.pickup_seq
    join public.ride_stops d on d.ride_id = b.ride_id and d.seq = b.drop_seq
   where b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED', 'COMPLETED', 'NO_SHOW')
     and (r.depart_at at time zone 'Asia/Kolkata')::date between p_from and p_to
   group by p.label, d.label
   order by count(*) desc, p.label, d.label
   limit greatest(1, least(p_limit, 100));
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Every member, with what an admin needs to know: contact, usual commute, record, activity.

create function public.admin_members(p_query text default null)
returns table (
  user_id uuid,
  name text,
  email text,
  phone text,
  home text,
  work text,
  is_admin boolean,
  removed_at timestamptz,
  reliability_score smallint,
  rides_offered integer,
  rides_taken integer,
  joined_at timestamptz,
  last_active date,
  active_days_30 integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not (select private.is_admin()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select u.id, u.name, a.email::text, u.phone, h.name, w.name, u.is_admin, u.removed_at,
         u.reliability_score,
         (select count(*) from public.rides r
           where r.owner_id = u.id and r.status <> 'CANCELLED')::integer,
         (select count(*) from public.bookings b
           where b.rider_id = u.id and b.status in ('CONFIRMED', 'COMPLETED', 'NO_SHOW'))::integer,
         u.created_at,
         (select max(m.day) from public.member_activity m where m.user_id = u.id),
         (select count(*) from public.member_activity m
           where m.user_id = u.id and m.day > (now() at time zone 'Asia/Kolkata')::date - 30)::integer
    from public.users u
    left join auth.users a on a.id = u.id
    left join public.places h on h.id = u.home_place_id
    left join public.places w on w.id = u.work_place_id
   where v_query is null
      or u.name ilike '%' || v_query || '%'
      or a.email ilike '%' || v_query || '%'
      or u.phone ilike '%' || v_query || '%'
   order by u.removed_at nulls first, u.created_at desc;
end
$$;

-- One member in full: profile, car, usual ride and activity. Their rides, bookings, reliability
-- events and reports are read directly (admins can see those under the access rules).
create function public.admin_member(p_user_id uuid)
returns table (
  user_id uuid,
  name text,
  email text,
  phone text,
  gender text,
  upi_vpa text,
  home text,
  work text,
  is_admin boolean,
  removed_at timestamptz,
  reliability_score smallint,
  rides_completed integer,
  no_shows_90d integer,
  late_cancels_90d integer,
  joined_at timestamptz,
  last_active date,
  active_days_30 integer,
  car text,
  plate text,
  usual_route text,
  usual_time time,
  usual_days smallint
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
  select u.id, u.name, a.email::text, u.phone, u.gender, u.upi_vpa, h.name, w.name,
         u.is_admin, u.removed_at, u.reliability_score, u.rides_completed, u.no_shows_90d,
         u.late_cancels_90d, u.created_at,
         (select max(m.day) from public.member_activity m where m.user_id = u.id),
         (select count(*) from public.member_activity m
           where m.user_id = u.id and m.day > (now() at time zone 'Asia/Kolkata')::date - 30)::integer,
         c.colour || ' ' || c.model || ' · ' || c.seats_total || ' seats',
         c.plate,
         (select string_agg(s.e ->> 'label', ' → ' order by s.ord)
            from jsonb_array_elements(ur.stops) with ordinality as s(e, ord)),
         ur.depart_time,
         ur.auto_golive_days
    from public.users u
    left join auth.users a on a.id = u.id
    left join public.places h on h.id = u.home_place_id
    left join public.places w on w.id = u.work_place_id
    left join lateral (
      select c.* from public.cars c where c.owner_id = u.id order by c.created_at limit 1
    ) c on true
    left join lateral (
      select r.* from public.usual_rides r where r.owner_id = u.id order by r.created_at limit 1
    ) ur on true
   where u.id = p_user_id;
end
$$;

revoke execute on function public.admin_summary() from public, anon;
revoke execute on function public.admin_daily_stats(date, date) from public, anon;
revoke execute on function public.admin_top_trips(date, date, integer) from public, anon;
revoke execute on function public.admin_members(text) from public, anon;
revoke execute on function public.admin_member(uuid) from public, anon;
grant execute on function public.admin_summary() to authenticated;
grant execute on function public.admin_daily_stats(date, date) to authenticated;
grant execute on function public.admin_top_trips(date, date, integer) to authenticated;
grant execute on function public.admin_members(text) to authenticated;
grant execute on function public.admin_member(uuid) to authenticated;
