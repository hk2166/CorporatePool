-- Moderation (T-7.2, F-G4): admins work through reports, remove people and hide rides. Every
-- action is written to admin_actions, the audit trail, with the admin and a reason.
--
-- * Removing someone: they're marked removed, their requests and seats on rides still to come
--   end (freed seats go to the waitlist), and their own rides still to come are cancelled (the
--   riders are told and re-matched). The app also bans their sign-in and turns them away on
--   every page. Restoring undoes the mark and the ban, not the cancellations.
-- * Hiding a ride: it disappears from search, cross-car matching and the public card, and
--   takes no new requests. It stays in people's history, and existing bookings stand.
-- * Reports are resolved (acted on) or dismissed.
--
-- Only the server calls these, after checking the caller is an admin; the functions check it
-- again.

alter table public.users add column removed_at timestamptz;
alter table public.rides add column hidden_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- Enforcement in the database itself: no new booking on a hidden ride, or for a removed rider,
-- whichever function writes it (requests, cross-car matching).

create function private.check_new_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.rides r where r.id = new.ride_id and r.hidden_at is not null)
     or exists (select 1 from public.users u where u.id = new.rider_id and u.removed_at is not null)
  then
    raise exception 'This ride isn''t taking requests' using errcode = 'P0001',
      hint = 'NOT_BOOKABLE';
  end if;
  return new;
end
$$;

create trigger bookings_check_new
  before insert on public.bookings
  for each row execute function private.check_new_booking();

-- Search, cross-car matching and the public card leave hidden rides out.
create or replace function private.match_rides(
  p_rider_id uuid,
  p_from extensions.geography,
  p_to extensions.geography,
  p_pickup_after timestamptz,          -- the car must reach the pickup stop in this window
  p_pickup_before timestamptz,
  p_seats smallint default 1
)
returns table (
  ride_id uuid,
  pickup_seq smallint,
  pickup_label text,
  pickup_at timestamptz,
  pickup_walk_m integer,
  drop_seq smallint,
  drop_label text,
  drop_at timestamptz,
  drop_walk_m integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.id)
         r.id,
         p.seq,
         p.label,
         r.depart_at + make_interval(mins => p.eta_offset_min),
         round(extensions.st_distance(p.geo, p_from))::integer,
         d.seq,
         d.label,
         r.depart_at + make_interval(mins => d.eta_offset_min),
         round(extensions.st_distance(d.geo, p_to))::integer
    from public.rides r
    join public.ride_stops p on p.ride_id = r.id
    join public.ride_stops d on d.ride_id = r.id and d.seq > p.seq
   where r.status in ('OPEN', 'ALLOCATING')      -- still taking requests
     and r.hidden_at is null                      -- hidden by an admin (T-7.2)
     and r.seats_left >= p_seats
     and r.depart_at > now()
     and r.owner_id <> p_rider_id
     and extensions.st_dwithin(p.geo, p_from, 2000)
     and extensions.st_dwithin(d.geo, p_to, 2000)
     and r.depart_at + make_interval(mins => p.eta_offset_min)
         between p_pickup_after and p_pickup_before
     and (
       not r.women_only
       or exists (select 1 from public.users u where u.id = p_rider_id and u.gender = 'female')
     )
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_rider_id and b.blocked_id = r.owner_id)
           or (b.blocker_id = r.owner_id and b.blocked_id = p_rider_id)
     )
   order by r.id, extensions.st_distance(p.geo, p_from) + extensions.st_distance(d.geo, p_to)
$$;

create or replace function public.get_public_ride(p_ride_id uuid)
returns table (
  ride_id uuid,
  depart_at timestamptz,
  price_per_seat integer,
  seats_left smallint,
  status public.ride_status,
  women_only boolean,
  owner_first_name text,
  stops jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.depart_at,
         r.price_per_seat,
         r.seats_left,
         r.status,
         r.women_only,
         split_part(u.name, ' ', 1),
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object(
                       'seq', s.seq, 'label', s.label, 'eta_offset_min', s.eta_offset_min
                     )
                     order by s.seq
                   )
              from public.ride_stops s
             where s.ride_id = r.id),
           '[]'::jsonb
         )
    from public.rides r
    join public.users u on u.id = r.owner_id
   where r.id = p_ride_id and r.hidden_at is null
$$;

-- ---------------------------------------------------------------------------------------------
-- The admin functions.

create function private.require_admin(p_admin_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select u.is_admin and u.removed_at is null from public.users u
                    where u.id = p_admin_id), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
end
$$;

create function public.admin_remove_user(p_admin_id uuid, p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_ride_id uuid;
begin
  perform private.require_admin(p_admin_id);
  if p_user_id = p_admin_id then
    raise exception 'You can''t remove yourself' using errcode = 'P0001', hint = 'SELF';
  end if;
  update public.users set removed_at = now() where id = p_user_id and removed_at is null;
  if not found then
    raise exception 'No such member, or already removed' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_user, reason)
  values (p_admin_id, 'REMOVE_USER', p_user_id, btrim(p_reason));

  -- Their requests and seats on rides still to come.
  for v_booking in
    select b.id, b.ride_id, b.status, b.seats
      from public.bookings b
      join public.rides r on r.id = b.ride_id
     where b.rider_id = p_user_id
       and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
       and r.status in ('OPEN', 'ALLOCATING', 'FULL')
       and r.depart_at > now()
  loop
    perform 1 from public.rides r where r.id = v_booking.ride_id for update;
    update public.bookings
       set status = 'CANCELLED', decided_at = now(), waitlist_rank = null
     where id = v_booking.id;
    if v_booking.status = 'CONFIRMED' then
      perform private.give_back_seats(v_booking.ride_id, v_booking.seats);
      perform private.promote(v_booking.ride_id);
    elsif v_booking.status = 'WAITLISTED' then
      perform private.renumber_waitlist(v_booking.ride_id);
    end if;
  end loop;

  -- Their own rides still to come.
  for v_ride_id in
    select r.id from public.rides r
     where r.owner_id = p_user_id and r.status in ('OPEN', 'ALLOCATING', 'FULL')
       and r.depart_at > now()
  loop
    perform public.cancel_ride(p_user_id, v_ride_id, 'The ride was cancelled by an admin');
  end loop;
end
$$;

create function public.admin_restore_user(p_admin_id uuid, p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin(p_admin_id);
  update public.users set removed_at = null where id = p_user_id and removed_at is not null;
  if not found then
    raise exception 'No such removed member' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_user, reason)
  values (p_admin_id, 'RESTORE_USER', p_user_id, btrim(p_reason));
end
$$;

create function public.admin_set_ride_hidden(
  p_admin_id uuid, p_ride_id uuid, p_hidden boolean, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin(p_admin_id);
  update public.rides
     set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end
   where id = p_ride_id;
  if not found then
    raise exception 'No such ride' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_ride, reason)
  values (p_admin_id, case when p_hidden then 'HIDE_RIDE' else 'UNHIDE_RIDE' end::public.admin_action_kind,
          p_ride_id, btrim(p_reason));
end
$$;

create function public.admin_close_report(
  p_admin_id uuid, p_report_id uuid, p_resolved boolean, p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin(p_admin_id);
  update public.reports
     set status = case when p_resolved then 'RESOLVED' else 'DISMISSED' end::public.report_status,
         resolved_at = now()
   where id = p_report_id and status = 'OPEN';
  if not found then
    raise exception 'No such open report' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_report, reason)
  values (p_admin_id,
          case when p_resolved then 'RESOLVE_REPORT' else 'DISMISS_REPORT' end::public.admin_action_kind,
          p_report_id, btrim(p_reason));
end
$$;

-- Removed members, for the admin page (removed_at is private like the other account columns).
create function public.admin_removed_users()
returns table (user_id uuid, name text, removed_at timestamptz)
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
  select u.id, u.name, u.removed_at from public.users u
   where u.removed_at is not null order by u.removed_at desc;
end
$$;

revoke execute on function private.require_admin(uuid) from public;
revoke execute on function public.admin_remove_user(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_restore_user(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_set_ride_hidden(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.admin_close_report(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.admin_removed_users() from public, anon;
grant execute on function public.admin_remove_user(uuid, uuid, text) to service_role;
grant execute on function public.admin_restore_user(uuid, uuid, text) to service_role;
grant execute on function public.admin_set_ride_hidden(uuid, uuid, boolean, text) to service_role;
grant execute on function public.admin_close_report(uuid, uuid, boolean, text) to service_role;
grant execute on function public.admin_removed_users() to authenticated;
