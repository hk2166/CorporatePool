-- Owners' UPI QR codes (20261017100000_payment_qr.sql): the same people who see the UPI ID
-- see the QR image.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fixtures (all fake): owner O has a QR code; R has a confirmed seat on O's ride; S is a
-- stranger.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009a0', 'demo.qr.owner@example.com'),
  ('00000000-0000-0000-0000-0000000009a1', 'demo.qr.rider@example.com'),
  ('00000000-0000-0000-0000-0000000009a2', 'demo.qr.stranger@example.com');
insert into users (id, name, upi_qr_path) values
  ('00000000-0000-0000-0000-0000000009a0', 'Demo QR Owner',
   '00000000-0000-0000-0000-0000000009a0/qr.jpg'),
  ('00000000-0000-0000-0000-0000000009a1', 'Demo QR Rider', null),
  ('00000000-0000-0000-0000-0000000009a2', 'Demo QR Stranger', null);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-0000000009a0', '00000000-0000-0000-0000-0000000009a0',
   'Demo Hatchback', 'White', 'HR26DM0970', 4);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat) values
  ('40000000-0000-0000-0000-0000000009a0', '00000000-0000-0000-0000-0000000009a0',
   '20000000-0000-0000-0000-0000000009a0', now() + interval '1 day', now(), 3, 2, 150);
insert into ride_stops (ride_id, seq, geo, label, eta_offset_min) values
  ('40000000-0000-0000-0000-0000000009a0', 0,
   extensions.st_makepoint(77.3260, 28.1440)::extensions.geography, 'Demo Start', 0),
  ('40000000-0000-0000-0000-0000000009a0', 1,
   extensions.st_makepoint(77.0880, 28.4950)::extensions.geography, 'Demo End', 70);
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at) values
  ('40000000-0000-0000-0000-0000000009a0', '00000000-0000-0000-0000-0000000009a1', 0, 1,
   'CONFIRMED', now());
insert into storage.objects (bucket_id, name) values
  ('payment-qr', '00000000-0000-0000-0000-0000000009a0/qr.jpg');

select is((select public from storage.buckets where id = 'payment-qr'), false,
  'the payment-qr bucket is private (no public URLs)');
select throws_ok($$
  update users set upi_qr_path = '00000000-0000-0000-0000-0000000009a2/qr.jpg'
   where id = '00000000-0000-0000-0000-0000000009a0'
$$, '23514', null, 'a QR path must be in the person''s own folder');

set local role authenticated;
create temporary view qr_count as
  select count(*) as n from storage.objects
   where bucket_id = 'payment-qr' and name = '00000000-0000-0000-0000-0000000009a0/qr.jpg';

-- Owner
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000009a0"}', true);
select is((select n from qr_count), 1::bigint, 'owner: sees their QR code');
select lives_ok($$
  update users set upi_qr_path = null where id = '00000000-0000-0000-0000-0000000009a0'
$$, 'owner: can remove it from their profile');
reset role;
update users set upi_qr_path = '00000000-0000-0000-0000-0000000009a0/qr.jpg'
 where id = '00000000-0000-0000-0000-0000000009a0';
set local role authenticated;

-- Confirmed rider
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000009a1"}', true);
select is((select n from qr_count), 1::bigint,
  'confirmed rider: sees the QR code of the owner they ride with');
select is(get_payment_qr('00000000-0000-0000-0000-0000000009a0'),
  '00000000-0000-0000-0000-0000000009a0/qr.jpg', 'confirmed rider: gets its path');

-- Stranger
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000009a2"}', true);
select is((select n from qr_count), 0::bigint, 'stranger: can''t see the QR code');
select is(get_payment_qr('00000000-0000-0000-0000-0000000009a0'), null,
  'stranger: gets no path');
select throws_ok($$
  insert into storage.objects (bucket_id, name) values
    ('payment-qr', '00000000-0000-0000-0000-0000000009a0/fake.jpg')
$$, '42501', null, 'stranger: can''t upload into someone else''s folder');
select lives_ok($$
  insert into storage.objects (bucket_id, name) values
    ('payment-qr', '00000000-0000-0000-0000-0000000009a2/mine.jpg')
$$, 'anyone: can upload into their own folder');

-- Visitors who aren't signed in
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select count(*) from storage.objects where bucket_id = 'payment-qr'), 0::bigint,
  'visitor: sees no QR codes at all');

select * from finish();
rollback;
