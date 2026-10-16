-- Account deletion (T-2.4, F-A9): remove everything that identifies the person, but keep the
-- history other people's rides and scores depend on.
--
-- anonymise_account() does the database part in one transaction. The server (app/profile)
-- then deletes the photo files and the sign-in account. Only the server can call it, after
-- confirming who's asking.

create function public.anonymise_account(p_user_id uuid)
returns text[]                -- the car photo paths whose files the server should delete
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photos text[];
begin
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'No such member' using errcode = 'P0002';
  end if;

  -- Upcoming rides and seats must be cancelled through the app first, so seats go back to
  -- the pool and the other people are told (the cancel flows of Phases 3 and 5).
  if exists (
       select 1 from public.rides r
        where r.owner_id = p_user_id
          and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED')
     )
     or exists (
       select 1 from public.bookings b
         join public.rides r on r.id = b.ride_id
        where b.rider_id = p_user_id
          and b.status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED')
          and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED')
     )
  then
    raise exception 'Cancel your upcoming rides and seats first'
      using errcode = 'P0001', hint = 'ACTIVE_RIDES';
  end if;

  select coalesce(array_agg(p), '{}') into v_photos
    from public.cars c, unnest(c.photo_paths) as p
   where c.owner_id = p_user_id;

  -- Templates are only ever the owner's.
  delete from public.usual_rides where owner_id = p_user_id;

  -- Cars nobody rode in go entirely. Cars with past rides stay (rides point at them) but lose
  -- everything identifying: the plate becomes a unique placeholder and the photos go.
  delete from public.cars c
   where c.owner_id = p_user_id
     and not exists (select 1 from public.rides r where r.car_id = c.id);
  update public.cars
     set model = 'Deleted car',
         colour = 'Unknown',
         plate = 'DEL' || upper(left(md5(id::text), 9)),
         photo_paths = '{}'
   where owner_id = p_user_id;

  delete from public.push_subscriptions where user_id = p_user_id;
  delete from public.blocks where blocker_id = p_user_id or blocked_id = p_user_id;
  delete from public.notifications_outbox where user_id = p_user_id;

  -- The profile stays as "Deleted user", so bookings and ride history still make sense.
  update public.users
     set name = 'Deleted user',
         photo_url = null,
         phone = null,
         gender = null,
         upi_vpa = null,
         home_place_id = null,
         work_place_id = null,
         is_admin = false
   where id = p_user_id;

  return v_photos;
end
$$;

revoke execute on function public.anonymise_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_account(uuid) to service_role;
