-- Paying after the ride (F-D8): riders pay the owner by UPI once they're at the office, and
-- the owner may tap Complete before they do. So the two sides of a booking can still see each
-- other's contact (name, phone, UPI ID) for a day after a completed ride, then not any more.
-- Before this, it vanished the moment the ride was completed.

create or replace function private.in_confirmed_booking_with(p_other uuid)
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
     where (
             (b.status = 'CONFIRMED' and r.status in ('OPEN', 'ALLOCATING', 'FULL', 'STARTED'))
             or (b.status = 'COMPLETED' and r.depart_at > now() - interval '1 day')
           )
       and (
         (b.rider_id = (select auth.uid()) and r.owner_id = p_other)
         or (r.owner_id = (select auth.uid()) and b.rider_id = p_other)
       )
  )
$$;
