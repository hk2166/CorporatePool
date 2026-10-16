-- Access rules, part 2 of 3 (T-1.3): users, blocks, push_subscriptions, signup_tokens.
-- Same model as part 1: reads through RLS, rule-bound writes by the server only, private
-- columns behind column privileges and get_* functions.

-- ---------------------------------------------------------------------------------------------
-- users
--
-- Every signed-in member sees everyone's name and photo, as in the WhatsApp group today.
-- Everything else is private:
-- * phone and UPI ID: you, admins, and the other side of a confirmed booking until the ride
--   ends (get_contact) (F-F1, F-D8)
-- * reliability score and counters: you and admins (get_reliability) (D10)
-- * gender, home and work stops, is_admin: you (get_my_profile); the server uses gender for
--   women-only rides
-- People edit their own profile directly. Nobody can make themselves an admin or change their
-- own score, because those columns aren't updatable. The server creates profile rows at
-- sign-up, after checking the invite (T-2.1), and handles account deletion (T-2.4).

revoke all on public.users from anon;
revoke select, insert, update, delete on public.users from authenticated;
grant select (id, name, photo_url, created_at) on public.users to authenticated;
grant update (name, photo_url, phone, gender, upi_vpa, home_place_id, work_place_id)
  on public.users to authenticated;

create policy "Signed-in users can see names and photos"
  on public.users for select to authenticated
  using (true);

create policy "People edit their own profile"
  on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- True when the signed-in user and p_other are the two sides of a confirmed booking on a ride
-- that hasn't finished: a rider and the ride's owner, either way round.
create function private.in_confirmed_booking_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.bookings b
      join public.rides r on r.id = b.ride_id
     where b.status = 'CONFIRMED'
       and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED')
       and (
         (b.rider_id = (select auth.uid()) and r.owner_id = p_other)
         or (r.owner_id = (select auth.uid()) and b.rider_id = p_other)
       )
  )
$$;

revoke execute on function private.in_confirmed_booking_with(uuid) from public;
grant execute on function private.in_confirmed_booking_with(uuid) to authenticated;

-- Your whole profile, including the private columns.
create function public.get_my_profile()
returns setof public.users
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.users u where u.id = (select auth.uid())
$$;

-- Name, phone and UPI ID: for yourself, an admin, or the other side of a confirmed booking
-- (the WhatsApp and Pay by UPI buttons, F-D8). No row for anyone else.
create function public.get_contact(p_user_id uuid)
returns table (name text, phone text, upi_vpa text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.name, u.phone, u.upi_vpa
    from public.users u
   where u.id = p_user_id
     and (
       u.id = (select auth.uid())
       or (select private.is_admin())
       or (select private.in_confirmed_booking_with(p_user_id))
     )
$$;

-- Reliability score and counters: for yourself (F-F4) or an admin (F-G1).
create function public.get_reliability(p_user_id uuid)
returns table (
  reliability_score smallint,
  rides_completed integer,
  no_shows_90d integer,
  late_cancels_90d integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.reliability_score, u.rides_completed, u.no_shows_90d, u.late_cancels_90d
    from public.users u
   where u.id = p_user_id
     and (u.id = (select auth.uid()) or (select private.is_admin()))
$$;

revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.get_contact(uuid) from public, anon;
revoke execute on function public.get_reliability(uuid) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_contact(uuid) to authenticated;
grant execute on function public.get_reliability(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- blocks: only the person who blocked sees the block, so nobody can find out who blocked them
-- (F-F8). Search and allocation read blocks on the server.

revoke all on public.blocks from anon;
revoke update on public.blocks from authenticated;

create policy "People see their own blocks"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "People block others themselves"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "People remove their own blocks"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- push_subscriptions: each person registers and removes their own browsers (F-E1). The push
-- sender reads all of them on the server.

revoke all on public.push_subscriptions from anon;

create policy "People manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- signup_tokens: admins can see the invites. Creating and redeeming them goes through the
-- server (T-2.1, T-7.3), so nobody writes them directly.

revoke all on public.signup_tokens from anon;
revoke insert, update, delete on public.signup_tokens from authenticated;

create policy "Admins can see invites"
  on public.signup_tokens for select to authenticated
  using ((select private.is_admin()));
