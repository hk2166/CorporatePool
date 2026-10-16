-- GENERATED from supabase/seed/landmarks.csv by `npm run seed:landmarks`. Don't edit this
-- file: change the CSV and run the command again. CI fails if this file is out of date.
insert into public.places (name, kind, geo) values
  ('Demo Palwal Start', 'town', extensions.st_setsrid(extensions.st_makepoint(77.32900, 28.14400), 4326)::extensions.geography),
  ('Demo Stop 01', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.31626, 28.16284), 4326)::extensions.geography),
  ('Demo Stop 02', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.30353, 28.18168), 4326)::extensions.geography),
  ('Demo Stop 03', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.29079, 28.20053), 4326)::extensions.geography),
  ('Demo Stop 04', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.27805, 28.21937), 4326)::extensions.geography),
  ('Demo Stop 05', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.26532, 28.23821), 4326)::extensions.geography),
  ('Demo Stop 06', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.25258, 28.25705), 4326)::extensions.geography),
  ('Demo Stop 07', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.23984, 28.27589), 4326)::extensions.geography),
  ('Demo Stop 08', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.22711, 28.29474), 4326)::extensions.geography),
  ('Demo Stop 09', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.21437, 28.31358), 4326)::extensions.geography),
  ('Demo Stop 10', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.20163, 28.33242), 4326)::extensions.geography),
  ('Demo Stop 11', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.18889, 28.35126), 4326)::extensions.geography),
  ('Demo Stop 12', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.17616, 28.37011), 4326)::extensions.geography),
  ('Demo Stop 13', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.16342, 28.38895), 4326)::extensions.geography),
  ('Demo Stop 14', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.15068, 28.40779), 4326)::extensions.geography),
  ('Demo Stop 15', 'landmark', extensions.st_setsrid(extensions.st_makepoint(77.13795, 28.42663), 4326)::extensions.geography),
  ('Demo Metro Stop', 'metro', extensions.st_setsrid(extensions.st_makepoint(77.12521, 28.44547), 4326)::extensions.geography),
  ('Demo Office Park', 'office', extensions.st_setsrid(extensions.st_makepoint(77.11247, 28.46432), 4326)::extensions.geography),
  ('Demo Shankar Chowk', 'office', extensions.st_setsrid(extensions.st_makepoint(77.09974, 28.48316), 4326)::extensions.geography),
  ('Demo Cyber City', 'office', extensions.st_setsrid(extensions.st_makepoint(77.08700, 28.50200), 4326)::extensions.geography);
