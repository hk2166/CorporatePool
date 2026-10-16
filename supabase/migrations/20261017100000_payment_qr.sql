-- Owners' UPI QR codes: the "scan to pay" image from their UPI app, shown next to their UPI ID
-- to riders who owe them for a seat. It follows the same rule as the phone number and UPI ID
-- (get_contact): the owner, admins, and the other side of a confirmed booking until a day
-- after the ride.
--
-- The image lives in the private `payment-qr` bucket as <user id>/<random>.jpg, and
-- users.upi_qr_path points at it.

alter table public.users
  add column upi_qr_path text
    -- Only a file in the person's own folder.
    check (upi_qr_path is null or split_part(upi_qr_path, '/', 1) = id::text);

grant update (upi_qr_path) on public.users to authenticated;

-- Who may see one QR image, by its Storage path. It reads users.upi_qr_path, which signed-in
-- users can't, so it runs with the owner's rights (security definer).
create function private.can_see_payment_qr(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.users u
     where u.upi_qr_path = p_path
       and (
         u.id = (select auth.uid())
         or (select private.is_admin())
         or private.in_confirmed_booking_with(u.id)
       )
  )
$$;

revoke execute on function private.can_see_payment_qr(text) from public;
grant execute on function private.can_see_payment_qr(text) to authenticated;

-- Someone's QR image path, for the same people as get_contact. Nothing for anyone else.
create function public.get_payment_qr(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.upi_qr_path
    from public.users u
   where u.id = p_user_id
     and (
       u.id = (select auth.uid())
       or (select private.is_admin())
       or private.in_confirmed_booking_with(p_user_id)
     )
$$;

revoke execute on function public.get_payment_qr(uuid) from public, anon;
grant execute on function public.get_payment_qr(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The bucket. Private: nothing in it has a public URL.

insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', false)
on conflict (id) do nothing;

-- At most 300 KB, JPEG or WebP (the app resizes images before uploading, as for car photos).
-- Set only where the Storage service has these columns (not in CI's database-only run).
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
     where id = 'payment-qr';
  end if;
end
$$;

create policy "Owners upload their payment QR into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owners delete their own payment QR"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-qr'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Payment QR codes are visible to whoever may see the UPI ID"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-qr'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
      or private.can_see_payment_qr(name)
    )
  );
