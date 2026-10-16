-- Contact for paying after the ride (F-D8): visible for a day after a completed ride.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000b01', 'demo.pay.owner@example.com'),
  ('00000000-0000-0000-0000-000000000b02', 'demo.pay.rider@example.com'),
  ('00000000-0000-0000-0000-000000000b03', 'demo.pay.other@example.com');
insert into users (id, name, phone, upi_vpa) values
  ('00000000-0000-0000-0000-000000000b01', 'Demo Owner', '+919999920001', 'demo.owner@upi'),
  ('00000000-0000-0000-0000-000000000b02', 'Demo Rider', '+919999920002', null),
  ('00000000-0000-0000-0000-000000000b03', 'Demo Other', '+919999920003', null);
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b01',
   'Demo Car', 'White', 'HR26DM0B01', 4);
insert into rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                   price_per_seat, status)
values ('30000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b01',
        '20000000-0000-0000-0000-000000000b01', now() - interval '2 hours',
        now() - interval '12 hours', 3, 2, 150, 'COMPLETED');
insert into ride_stops (ride_id, seq, geo, label) values
  ('30000000-0000-0000-0000-000000000b01', 0, extensions.st_makepoint(77.3, 28.1)::extensions.geography, 'Demo A'),
  ('30000000-0000-0000-0000-000000000b01', 1, extensions.st_makepoint(77.1, 28.5)::extensions.geography, 'Demo B');
insert into bookings (ride_id, rider_id, pickup_seq, drop_seq, status, decided_at)
values ('30000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-000000000b02', 0, 1,
        'COMPLETED', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000b02"}', true);
select is(
  (select upi_vpa from get_contact('00000000-0000-0000-0000-000000000b01')),
  'demo.owner@upi', 'two hours after the ride, the rider can still get the owner''s UPI ID to pay');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000b01"}', true);
select is(
  (select phone from get_contact('00000000-0000-0000-0000-000000000b02')),
  '+919999920002', 'and the owner the rider''s number');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000b03"}', true);
select is((select count(*) from get_contact('00000000-0000-0000-0000-000000000b01')), 0::bigint,
  'someone who wasn''t on the ride still can''t');

reset role;
update rides set depart_at = now() - interval '25 hours', allocation_at = now() - interval '35 hours';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000b02"}', true);
select is((select count(*) from get_contact('00000000-0000-0000-0000-000000000b01')), 0::bigint,
  'a day after the ride, the contact is private again');

reset role;
update bookings set status = 'NO_SHOW';
update rides set depart_at = now() - interval '2 hours', allocation_at = now() - interval '12 hours';
set local role authenticated;
select is((select count(*) from get_contact('00000000-0000-0000-0000-000000000b01')), 0::bigint,
  'a rider who didn''t turn up doesn''t get it');

select * from finish();
rollback;
