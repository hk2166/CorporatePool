-- The common stops on the Palwal–Gurugram commute (H-5, in part): the places drivers in the
-- commuting group name every day. Positions are from OpenStreetMap (© OpenStreetMap
-- contributors, ODbL), looked up by name on 16 Oct 2026; each line says which map feature it
-- is. Rajiv Chowk is the middle of the Rajiv Chowk underpass on NH-48.
--
-- Stops the map doesn't have yet (Agra Chowk and the bus stand in Palwal, Alawalpur Chowk,
-- Bamnikhera, Mitrol, Candor TechSpace Sector 21, the Zomato office, Urbana Chowk, Samrat
-- Sweets) aren't guessed: admins add them under Admin → Stops, and members with "Add a stop".
--
-- Safe on any database: a stop is skipped when one with the same name (any case) or one
-- within 150 m is already there, the same rule as add_place().

with stop (name, kind, lat, lng) as (
  values
    -- Palwal side
    ('Hodal', 'town', 27.89992, 77.37393),                                -- place=city
    -- Gurugram, along NH-48
    ('Subhash Chowk', 'landmark', 28.42772, 77.03711),                    -- bus stop at the underpass
    ('Rajiv Chowk', 'landmark', 28.44550, 77.03335),                      -- Rajiv Chowk underpass
    ('Gurugram Bus Stand', 'landmark', 28.46517, 77.03224),               -- amenity=bus_station
    ('Presidency Tower, Sector 14', 'office', 28.46808, 77.04084),        -- landuse=commercial
    ('IFFCO Chowk', 'landmark', 28.47243, 77.07224),                      -- place=suburb, by the metro
    ('Atlas Chowk', 'landmark', 28.49112, 77.08099),                      -- junction
    ('Shankar Chowk (Shyam Chowk)', 'landmark', 28.49571, 77.08607),      -- motorway junction
    -- Cyber City
    ('DLF Cyber City / CyberHub', 'office', 28.49792, 77.08869),          -- bus stop on NH-48
    ('DLF Cyber Park', 'office', 28.50302, 77.08979),                     -- building
    ('DLF Cyber Green', 'office', 28.49422, 77.09270),                    -- Tower A
    -- Rapid Metro, Golf Course Road
    ('DLF Phase 2 Rapid Metro', 'metro', 28.48756, 77.09299),             -- railway=station
    ('DLF Phase 1 Rapid Metro', 'metro', 28.47076, 77.09423),             -- the station's bus stop
    ('Sector 53-54 Rapid Metro', 'metro', 28.44638, 77.10045),            -- railway=station
    ('Sector 54 Chowk Rapid Metro', 'metro', 28.43298, 77.10490),         -- railway=station
    ('Sector 55-56 Rapid Metro', 'metro', 28.42336, 77.10513),            -- railway=station
    -- Golf Course Extension Road and Badshahpur
    ('Paras Trinity, Sector 63', 'office', 28.40100, 77.09166),           -- building
    ('Badshahpur', 'town', 28.39328, 77.04842)                            -- place=locality
)
insert into public.places (name, kind, geo)
select s.name, s.kind::public.place_kind,
       extensions.st_setsrid(extensions.st_makepoint(s.lng, s.lat), 4326)::extensions.geography
  from stop s
 where not exists (
         select 1 from public.places p
          where lower(p.name) = lower(s.name)
             or extensions.st_dwithin(
                  p.geo,
                  extensions.st_setsrid(extensions.st_makepoint(s.lng, s.lat), 4326)::extensions.geography,
                  150)
       )
on conflict (name) do nothing;
