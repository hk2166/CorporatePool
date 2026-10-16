-- The common stops on the Palwal–Gurugram commute (20261016174411_common_stops.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

create temporary table common (name text) on commit drop;
insert into common values
  ('Hodal'), ('Subhash Chowk'), ('Rajiv Chowk'), ('Gurugram Bus Stand'),
  ('Presidency Tower, Sector 14'), ('IFFCO Chowk'), ('Atlas Chowk'),
  ('Shankar Chowk (Shyam Chowk)'), ('DLF Cyber City / CyberHub'), ('DLF Cyber Park'),
  ('DLF Cyber Green'), ('DLF Phase 2 Rapid Metro'), ('DLF Phase 1 Rapid Metro'),
  ('Sector 53-54 Rapid Metro'), ('Sector 54 Chowk Rapid Metro'), ('Sector 55-56 Rapid Metro'),
  ('Paras Trinity, Sector 63'), ('Badshahpur');

select is((select count(*) from places p join common c using (name)), 18::bigint,
  'all 18 common stops are in the list');

-- Every one is on the commute: between Hodal in the south and Cyber City in the north.
select is(
  (select count(*) from places p join common c using (name)
    where extensions.st_y(p.geo::extensions.geometry) not between 27.85 and 28.55
       or extensions.st_x(p.geo::extensions.geometry) not between 76.95 and 77.45),
  0::bigint, 'and every one is between Hodal and Cyber City');

-- No two are so close that riders would have to guess which to pick (add_place's 150 m).
select is(
  (select count(*) from places a join common ca on ca.name = a.name,
                        places b join common cb on cb.name = b.name
    where a.name < b.name and extensions.st_dwithin(a.geo, b.geo, 150)),
  0::bigint, 'and no two are within 150 m of each other');

select * from finish();
rollback;
