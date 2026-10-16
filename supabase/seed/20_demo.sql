-- Local demo data (T-1.4): 3 people, 1 car, 1 usual ride and tomorrow's 08:00 ride.
--
-- Only the LOCAL database loads this (`npm run db:reset`, or the first `npm run db:start`). It
-- is never pushed to the live project. Everyone here is fake: names start with "Demo", emails
-- use example.com, and phones are +91 99999 0000x placeholders.
--
-- The three people can sign in to the local app with email and password, for testing screens
-- before Google sign-in exists. The live project only allows Google.
--   seed-owner@example.com   owns the car and the ride
--   seed-rider@example.com   commutes from the first stop to the last
--   seed-admin@example.com   admin
--   password for all three:  demo-password
--
-- Nothing here depends on stop names, so the real stop list (H-5) can replace the demo one:
-- the ride runs from the southernmost stop to the northernmost, through the stop halfway.

-- Sign-in accounts. The empty strings matter: Supabase Auth can't read NULL in its token
-- columns.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
       extensions.crypt('demo-password', extensions.gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
       '', '', '', '', '', '', '', ''
  from (values
    ('5eed0000-0000-0000-0000-000000000001'::uuid, 'seed-owner@example.com'),
    ('5eed0000-0000-0000-0000-000000000002'::uuid, 'seed-rider@example.com'),
    ('5eed0000-0000-0000-0000-000000000003'::uuid, 'seed-admin@example.com')
  ) as p (id, email);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.id in (
   '5eed0000-0000-0000-0000-000000000001',
   '5eed0000-0000-0000-0000-000000000002',
   '5eed0000-0000-0000-0000-000000000003'
 );

-- Profiles.
insert into public.users (id, name, phone, upi_vpa, is_admin, ride_preference) values
  ('5eed0000-0000-0000-0000-000000000001', 'Demo Owner', '+919999900001', 'demo.owner@okdemo', false, 'DRIVER'),
  ('5eed0000-0000-0000-0000-000000000002', 'Demo Rider', '+919999900002', null, false, 'RIDER'),
  ('5eed0000-0000-0000-0000-000000000003', 'Demo Admin', '+919999900003', null, true, 'BOTH');

-- The car, the usual ride and tomorrow's ride, on a route picked by position, not name.
do $$
declare
  v_start public.places;
  v_middle public.places;
  v_end public.places;
  v_stop_count integer;
  -- Tomorrow 08:00 in India; ranked allocation runs at 22:00 the evening before (Q6).
  v_depart timestamptz :=
    ((now() at time zone 'Asia/Kolkata')::date + 1 + time '08:00') at time zone 'Asia/Kolkata';
begin
  select count(*) into v_stop_count from public.places;
  if v_stop_count < 3 then
    raise exception 'The demo ride needs at least 3 stops in supabase/seed/landmarks.csv';
  end if;

  select * into v_start from public.places
   order by extensions.st_y(geo::extensions.geometry), name limit 1;
  select * into v_end from public.places
   order by extensions.st_y(geo::extensions.geometry) desc, name limit 1;
  select * into v_middle from public.places
   order by extensions.st_y(geo::extensions.geometry), name
  offset (v_stop_count - 1) / 2 limit 1;

  update public.users set home_place_id = v_start.id, work_place_id = v_end.id
   where id = '5eed0000-0000-0000-0000-000000000002';

  insert into public.cars (id, owner_id, model, colour, plate, seats_total) values
    ('5eed0000-0000-0000-0000-0000000000c1', '5eed0000-0000-0000-0000-000000000001',
     'Demo Hatchback', 'White', 'XX01DM0001', 4);

  insert into public.usual_rides (id, owner_id, car_id, depart_time, seats_offered,
                                  price_per_seat, notes, stops) values
    ('5eed0000-0000-0000-0000-0000000000a1', '5eed0000-0000-0000-0000-000000000001',
     '5eed0000-0000-0000-0000-0000000000c1', '08:00', 3, 150, 'Demo ride. AC, no smoking.',
     jsonb_build_array(
       jsonb_build_object('place_id', v_start.id, 'label', v_start.name, 'eta_offset_min', 0,
                          'lat', extensions.st_y(v_start.geo::extensions.geometry),
                          'lng', extensions.st_x(v_start.geo::extensions.geometry)),
       jsonb_build_object('place_id', v_middle.id, 'label', v_middle.name, 'eta_offset_min', 35,
                          'lat', extensions.st_y(v_middle.geo::extensions.geometry),
                          'lng', extensions.st_x(v_middle.geo::extensions.geometry)),
       jsonb_build_object('place_id', v_end.id, 'label', v_end.name, 'eta_offset_min', 70,
                          'lat', extensions.st_y(v_end.geo::extensions.geometry),
                          'lng', extensions.st_x(v_end.geo::extensions.geometry))
     ));

  insert into public.rides (id, owner_id, car_id, usual_ride_id, depart_at, allocation_at,
                            seats_total, seats_left, price_per_seat, notes) values
    ('5eed0000-0000-0000-0000-0000000000d1', '5eed0000-0000-0000-0000-000000000001',
     '5eed0000-0000-0000-0000-0000000000c1', '5eed0000-0000-0000-0000-0000000000a1',
     v_depart, v_depart - interval '10 hours', 3, 3, 150, 'Demo ride. AC, no smoking.');

  insert into public.ride_stops (ride_id, seq, place_id, geo, label, eta_offset_min) values
    ('5eed0000-0000-0000-0000-0000000000d1', 0, v_start.id, v_start.geo, v_start.name, 0),
    ('5eed0000-0000-0000-0000-0000000000d1', 1, v_middle.id, v_middle.geo, v_middle.name, 35),
    ('5eed0000-0000-0000-0000-0000000000d1', 2, v_end.id, v_end.geo, v_end.name, 70);
end
$$;
