-- Access rules, part 1 of 3 (T-1.3): places, cars, usual_rides, rides, ride_stops.
--
-- How access works (docs/hld.md "Security and privacy", D12):
-- * Signed-in users (role `authenticated`) read through Row-Level Security policies.
-- * Anything with business rules (going live, seats, bookings, scores) is written by the server
--   with the secret key (role `service_role`), which bypasses RLS. Those tables get no write
--   policies at all, so nobody can change a seat count from their browser.
-- * Private columns (plate, car photos; phone and scores in part 2) are hidden with column
--   privileges and read through functions that check who's asking.
-- * Visitors who aren't signed in (role `anon`) get only get_public_ride(), for the WhatsApp
--   ride card (F-H1).
--
-- Policies call auth.uid() as (select auth.uid()) so Postgres evaluates it once per query
-- instead of once per row.

-- ---------------------------------------------------------------------------------------------
-- Helpers. They live in a schema the API doesn't expose, so they can only be used inside
-- policies and other functions, never called directly over HTTP.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Security definer so it can read users.is_admin without tripping users' own policies.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.is_admin from public.users u where u.id = (select auth.uid())),
    false
  )
$$;

revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- places: every signed-in user can read the stop list; only admins change it (F-G6).

revoke all on public.places from anon;

create policy "Signed-in users can read places"
  on public.places for select to authenticated
  using (true);

create policy "Admins manage places"
  on public.places for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- cars: anyone signed in sees model, colour and seats (ride cards show them). The plate and
-- photos are private: only the owner and riders with a confirmed booking on the car's current
-- ride may see them (F-F1), through get_car_private() below. Owners add and edit their own cars
-- directly (F-A3).

revoke all on public.cars from anon;
revoke select, insert, update on public.cars from authenticated;
grant select (id, owner_id, model, colour, seats_total, created_at) on public.cars to authenticated;
grant insert (owner_id, model, colour, plate, seats_total, photo_paths) on public.cars to authenticated;
grant update (model, colour, plate, seats_total, photo_paths) on public.cars to authenticated;

create policy "Signed-in users can see cars"
  on public.cars for select to authenticated
  using (true);

create policy "Owners add their own cars"
  on public.cars for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners edit their own cars"
  on public.cars for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners remove their own cars"
  on public.cars for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Plate and photo paths, for the owner, an admin, or a rider with a confirmed booking on a ride
-- with this car that hasn't finished yet. Returns no row for anyone else.
create function public.get_car_private(p_car_id uuid)
returns table (plate text, photo_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.plate, c.photo_paths
    from public.cars c
   where c.id = p_car_id
     and (
       c.owner_id = (select auth.uid())
       or (select private.is_admin())
       or exists (
         select 1
           from public.rides r
           join public.bookings b on b.ride_id = r.id
          where r.car_id = c.id
            and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED')
            and b.rider_id = (select auth.uid())
            and b.status = 'CONFIRMED'
       )
     )
$$;

revoke execute on function public.get_car_private(uuid) from public, anon;
grant execute on function public.get_car_private(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- usual_rides: the owner's private template; nobody else sees it (F-B1). The owner edits it
-- directly. The (car_id, owner_id) foreign key already guarantees the car is theirs.

revoke all on public.usual_rides from anon;

create policy "Owners manage their usual rides"
  on public.usual_rides for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- rides and ride_stops: readable by every signed-in user (search, ride pages). Only the server
-- writes them: going live, seats and status all have rules (lld.md §2, §4).

revoke all on public.rides, public.ride_stops from anon;
revoke insert, update, delete on public.rides, public.ride_stops from authenticated;

create policy "Signed-in users can read rides"
  on public.rides for select to authenticated
  using (true);

create policy "Signed-in users can read ride stops"
  on public.ride_stops for select to authenticated
  using (true);

-- The public ride card behind a shared WhatsApp link (F-H1): route, time, price, seats left and
-- the owner's first name. Nothing that identifies or contacts anyone. Works without signing in.
create function public.get_public_ride(p_ride_id uuid)
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
   where r.id = p_ride_id
$$;

revoke execute on function public.get_public_ride(uuid) from public;
grant execute on function public.get_public_ride(uuid) to anon, authenticated;
