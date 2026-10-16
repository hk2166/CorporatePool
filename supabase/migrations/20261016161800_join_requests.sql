-- Join requests: a second way in, beside invite links (Q3 widened). Someone who signs in with
-- Google without an invite can ask to join; an admin accepts (which makes them a member, just
-- like redeeming an invite) or rejects.

create table public.join_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  email text,
  photo_url text,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.users (id) on delete set null
);

create index join_requests_pending_idx on public.join_requests (created_at)
  where status = 'PENDING';

-- People see their own request (to know where it stands); admins see them all. Writes go
-- through the functions below.
alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon, authenticated;
grant select on public.join_requests to authenticated;

create policy "People see their own join request"
  on public.join_requests for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins see all join requests"
  on public.join_requests for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- Asking to join, as the signed-in person. Name, email and photo come from their Google
-- account (not from the caller), plus an optional note for the admin. Asking again while
-- waiting updates the note; once rejected, only an invite link gets them in.

create function public.request_to_join(p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
  v_email text;
  v_meta jsonb;
  v_name text;
  v_photo text;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Already a member' using errcode = '22023', hint = 'MEMBER';
  end if;
  if exists (select 1 from public.join_requests r where r.user_id = v_uid and r.status = 'REJECTED') then
    raise exception 'Request declined' using errcode = '22023', hint = 'REJECTED';
  end if;

  select a.email, coalesce(a.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_meta
    from auth.users a
   where a.id = v_uid;
  v_name := left(coalesce(nullif(btrim(v_meta ->> 'full_name'), ''),
                          nullif(btrim(v_meta ->> 'name'), ''),
                          nullif(split_part(v_email, '@', 1), ''),
                          'New member'), 80);
  v_photo := coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture');
  if v_photo !~ '^https?://' then
    v_photo := null;
  end if;

  insert into public.join_requests (user_id, name, email, photo_url, note)
  values (v_uid, v_name, v_email, v_photo, v_note)
  on conflict (user_id) do update
    set name = excluded.name,
        email = excluded.email,
        photo_url = excluded.photo_url,
        note = excluded.note,
        -- An old accepted request whose membership has since gone starts again.
        created_at = case when public.join_requests.status = 'PENDING'
                          then public.join_requests.created_at else now() end,
        status = 'PENDING',
        decided_at = null,
        decided_by = null
    where public.join_requests.status <> 'REJECTED';
end
$$;

revoke execute on function public.request_to_join(text) from public, anon;
grant execute on function public.request_to_join(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- An admin's decision. Accepting creates the member's profile (as redeem_invite does); they're
-- in the next time they open the app. Rejecting an accepted request isn't possible: remove the
-- member instead. Called by the server with the secret key (app/admin/requests), like the
-- other admin actions.

create function public.admin_decide_join_request(
  p_admin_id uuid,
  p_user_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.join_requests;
begin
  perform private.require_admin(p_admin_id);

  select * into v_request from public.join_requests r where r.user_id = p_user_id for update;
  if not found then
    raise exception 'No such request' using errcode = 'P0002';
  end if;

  if p_accept then
    insert into public.users (id, name, photo_url)
    values (v_request.user_id, v_request.name, v_request.photo_url)
    on conflict (id) do nothing;
  elsif v_request.status = 'ACCEPTED' then
    raise exception 'Already accepted' using errcode = '22023', hint = 'ACCEPTED';
  end if;

  update public.join_requests r
     set status = case when p_accept then 'ACCEPTED' else 'REJECTED' end,
         decided_at = now(),
         decided_by = p_admin_id
   where r.user_id = p_user_id;
end
$$;

revoke execute on function public.admin_decide_join_request(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_decide_join_request(uuid, uuid, boolean) to service_role;
