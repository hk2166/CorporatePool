-- Route alerts: like the WhatsApp group, members hear about cars going their way without
-- looking. When a car goes live (by tap or automatically), members whose commute it serves get a
-- push: "New car on your route". A member's commute is their home and office stops, both ways:
-- home → office in the morning, office → home in the evening. Whether a car serves it is the
-- same rule as search (private.match_rides: within 2 km of both stops, in that order, women-only
-- and blocks respected). Free: it goes through the existing outbox and browser push.
--
-- Each member chooses: right away (the default), one summary at 20:00 for the next day, or off.
-- Members who only drive aren't told about other cars, and at most 10 alerts a day reach anyone.

alter table public.users
  add column ride_alerts text not null default 'INSTANT'
    check (ride_alerts in ('INSTANT', 'DIGEST', 'OFF'));
grant update (ride_alerts) on public.users to authenticated;

-- When members on the ride's route were told: once per ride.
alter table public.rides add column alerted_at timestamptz;

-- Which way a ride serves someone's commute: 'MORNING' (home → office), 'EVENING' (office →
-- home) or null, with the stops they'd get in and out at.
create function private.commute_match(p_ride_id uuid, p_user_id uuid)
returns table (direction text, pickup_label text, drop_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.direction, m.pickup_label, m.drop_label
    from public.users u
    join public.places h on h.id = u.home_place_id
    join public.places w on w.id = u.work_place_id
    cross join lateral (
      select 'MORNING' as direction, x.pickup_label, x.drop_label, 1 as pref
        from private.match_rides(u.id, h.geo, w.geo, now(), now() + interval '30 days') x
       where x.ride_id = p_ride_id
      union all
      select 'EVENING', x.pickup_label, x.drop_label, 2
        from private.match_rides(u.id, w.geo, h.geo, now(), now() + interval '30 days') x
       where x.ride_id = p_ride_id
    ) m
   where u.id = p_user_id
   order by m.pref
   limit 1
$$;

-- Members who can be told at all: not removed, with a commute and notifications switched on,
-- and not drivers only.
create function private.alertable_members(p_mode text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public.users u
   where u.ride_alerts = p_mode
     and u.removed_at is null
     and u.home_place_id is not null and u.work_place_id is not null
     and u.ride_preference is distinct from 'DRIVER'
     and exists (select 1 from public.push_subscriptions s where s.user_id = u.id)
$$;

-- Every 5 minutes: cars that went live since the last run, told to the members they serve.
create function public.run_route_alerts()
returns integer                                -- how many alerts were written
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with fresh as (
    update public.rides r
       set alerted_at = now()
     where r.alerted_at is null
       and r.status in ('OPEN', 'ALLOCATING')
       and r.hidden_at is null
       and r.depart_at > now()
    returning r.id, r.owner_id, r.seats_left, r.price_per_seat
  )
  insert into public.notifications_outbox (user_id, kind, payload)
  select m.member, 'ride_on_route',
         jsonb_build_object('ride_id', f.id, 'direction', c.direction,
                            'from', c.pickup_label, 'to', c.drop_label,
                            'seats_left', f.seats_left, 'price', f.price_per_seat)
    from fresh f
    cross join lateral private.alertable_members('INSTANT') as m(member)
    cross join lateral private.commute_match(f.id, m.member) c
   where m.member <> f.owner_id
     and (select count(*) from public.notifications_outbox o
           where o.user_id = m.member and o.kind = 'ride_on_route'
             and o.created_at > now() - interval '1 day') < 10;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- At 20:00 in India: one summary of tomorrow's cars to each member who asked for it.
create function public.run_route_digest()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_tomorrow date := (now() at time zone 'Asia/Kolkata')::date + 1;
begin
  with tally as (
    select m.member,
           count(*) filter (where c.direction = 'MORNING') as morning,
           count(*) filter (where c.direction = 'EVENING') as evening
      from private.alertable_members('DIGEST') as m(member)
      cross join public.rides r
      cross join lateral private.commute_match(r.id, m.member) c
     where r.status in ('OPEN', 'ALLOCATING')
       and r.hidden_at is null
       and (r.depart_at at time zone 'Asia/Kolkata')::date = v_tomorrow
       and r.owner_id <> m.member
     group by m.member
  )
  insert into public.notifications_outbox (user_id, kind, payload)
  select t.member, 'route_digest',
         jsonb_build_object('date', v_tomorrow, 'morning', t.morning, 'evening', t.evening,
                            'home', u.home_place_id, 'work', u.work_place_id)
    from tally t
    join public.users u on u.id = t.member
   where t.morning + t.evening > 0;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function private.commute_match(uuid, uuid) from public;
revoke execute on function private.alertable_members(text) from public;
revoke execute on function public.run_route_alerts() from public, anon, authenticated;
revoke execute on function public.run_route_digest() from public, anon, authenticated;
grant execute on function public.run_route_alerts() to service_role;
grant execute on function public.run_route_digest() to service_role;

select cron.schedule('route-alerts', '*/5 * * * *', $job$select public.run_route_alerts()$job$);
-- 14:30 UTC is 20:00 in India.
select cron.schedule('route-digest', '30 14 * * *', $job$select public.run_route_digest()$job$);
