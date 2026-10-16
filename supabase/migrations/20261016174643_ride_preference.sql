-- How each member mostly uses the app: looking for a ride, offering their seats, or both. Asked
-- once when they arrive (/welcome) and changed on their profile. It only decides what their
-- home page puts first; it doesn't stop anyone riding or driving.
--
-- Empty until they answer, which is how the app knows to ask. Like the rest of the profile,
-- people set their own (the existing "People edit their own profile" rule), and only they see
-- it, through get_my_profile().

alter table public.users
  add column ride_preference text
    check (ride_preference in ('RIDER', 'DRIVER', 'BOTH'));

grant update (ride_preference) on public.users to authenticated;
