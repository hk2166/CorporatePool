-- Car photos in Supabase Storage (T-2.3, F-A3, F-F1).
--
-- Photos live in the private `car-photos` bucket as <owner's user id>/<random>.jpg, and
-- cars.photo_paths lists them. They follow exactly the same rule as the number plate: the
-- owner, admins, and riders with a confirmed booking on the car's current ride. Signed URLs
-- (how the app shows a private photo) can only be made by someone the select rule allows.

-- ---------------------------------------------------------------------------------------------
-- One shared "who may see this car's private details" check, so the plate (get_car_private)
-- and the photos (storage rules below) can never disagree.

create function private.can_see_car_private(p_car_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
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
  )
$$;

revoke execute on function private.can_see_car_private(uuid) from public;
grant execute on function private.can_see_car_private(uuid) to authenticated;

-- The same check for one photo, by its Storage path. It reads cars.photo_paths, which is hidden
-- from signed-in users (T-1.3), so it has to run with the owner's rights (security definer).
create function private.can_see_car_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.cars c
     where p_path = any (c.photo_paths)
       and private.can_see_car_private(c.id)
  )
$$;

revoke execute on function private.can_see_car_photo(text) from public;
grant execute on function private.can_see_car_photo(text) to authenticated;

-- Same result as before, now built on the shared check.
create or replace function public.get_car_private(p_car_id uuid)
returns table (plate text, photo_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select c.plate, c.photo_paths
    from public.cars c
   where c.id = p_car_id
     and (select private.can_see_car_private(p_car_id))
$$;

-- ---------------------------------------------------------------------------------------------
-- The bucket. Private: nothing in it has a public URL.

insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', false)
on conflict (id) do nothing;

-- At most 300 KB and only JPEG or WebP (the app resizes photos to about 200 KB before
-- uploading). These columns only exist once the Storage service has upgraded its tables,
-- which CI's database-only run doesn't do, so they're set only where present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'storage' and table_name = 'buckets'
       and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets
       set file_size_limit = 300000,
           allowed_mime_types = array['image/jpeg', 'image/webp']
     where id = 'car-photos';
  end if;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Storage access rules. storage.foldername(name) splits the path, so [1] is the top folder:
-- the owner's user id.

create policy "Owners upload car photos into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners delete their own car photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'car-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Car photos are visible to whoever may see the car"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'car-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
      or private.can_see_car_photo(name)
    )
  );
