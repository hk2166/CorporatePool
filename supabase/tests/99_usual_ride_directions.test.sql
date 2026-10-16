-- Morning and evening usual rides: one of each per owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000001801', 'demo.dir.owner@example.com');
insert into users (id, name, phone) values ('00000000-0000-0000-0000-000000001801', 'Demo Dir Owner', '+919999981801');
insert into cars (id, owner_id, model, colour, plate, seats_total) values
  ('20000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001801', 'Demo Car', 'Grey', 'HR26DM1801', 4);

create function pg_temp.usual(p_direction text) returns void language sql as $$
  insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops, direction)
  values ('00000000-0000-0000-0000-000000001801', '20000000-0000-0000-0000-000000001801', '08:00', 3, 100,
          '[{"label": "A", "lat": 28.1, "lng": 77.3, "eta_offset_min": 0},
            {"label": "B", "lat": 28.5, "lng": 77.1, "eta_offset_min": 60}]',
          coalesce(p_direction, 'MORNING'))
$$;

insert into usual_rides (owner_id, car_id, depart_time, seats_offered, price_per_seat, stops)
values ('00000000-0000-0000-0000-000000001801', '20000000-0000-0000-0000-000000001801', '08:00', 3, 100,
        '[{"label": "A", "lat": 28.1, "lng": 77.3, "eta_offset_min": 0},
          {"label": "B", "lat": 28.5, "lng": 77.1, "eta_offset_min": 60}]');
select is((select direction from usual_rides where owner_id = '00000000-0000-0000-0000-000000001801'),
  'MORNING', 'a usual ride is a morning ride unless it says otherwise');

select lives_ok($$ select pg_temp.usual('EVENING') $$, 'an owner has an evening ride too');
select throws_ok($$ select pg_temp.usual('MORNING') $$, '23505', null, 'but one of each');
select throws_ok($$ select pg_temp.usual('NIGHT') $$, '23514', null, 'and only morning or evening');

select * from finish();
rollback;
