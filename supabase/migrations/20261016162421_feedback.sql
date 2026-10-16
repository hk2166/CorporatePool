-- Feedback (new): members send ideas and problems, and upvote the ones they want most, so the
-- admins can see what most people want. Admins mark each item planned, done or declined, with
-- an optional reply everyone sees.
--
-- Everything goes through the functions below: the tables aren't readable directly. Members see
-- every item and its vote count, but not who wrote it (only admins do), so people can be frank.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users (id) on delete set null,
  kind text not null check (kind in ('IDEA', 'PROBLEM')),
  title text not null check (char_length(title) between 3 and 120),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'OPEN' check (status in ('OPEN', 'PLANNED', 'DONE', 'DECLINED')),
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 500),
  created_at timestamptz not null default now()
);

create index feedback_author_idx on public.feedback (author_id, created_at);

create table public.feedback_votes (
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

create index feedback_votes_user_idx on public.feedback_votes (user_id);

alter table public.feedback enable row level security;
alter table public.feedback_votes enable row level security;
revoke all on public.feedback from anon, authenticated;
revoke all on public.feedback_votes from anon, authenticated;

-- The signed-in member (not removed), or 42501.
create function private.require_member()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (
    select 1 from public.users u where u.id = v_uid and u.removed_at is null
  ) then
    raise exception 'Members only' using errcode = '42501';
  end if;
  return v_uid;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Every item, with its votes and whether the caller voted. The author's name and id only for
-- admins (and "mine" for the author).

create function public.list_feedback()
returns table (
  id uuid,
  kind text,
  title text,
  details text,
  status text,
  admin_reply text,
  created_at timestamptz,
  votes integer,
  voted boolean,
  mine boolean,
  author_id uuid,
  author_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_admin boolean := (select private.is_admin());
begin
  return query
  select f.id, f.kind, f.title, f.details, f.status, f.admin_reply, f.created_at,
         (select count(*) from public.feedback_votes v where v.feedback_id = f.id)::integer,
         exists (select 1 from public.feedback_votes v where v.feedback_id = f.id and v.user_id = v_uid),
         f.author_id is not distinct from v_uid,
         case when v_admin then f.author_id end,
         case when v_admin then u.name end
    from public.feedback f
    left join public.users u on u.id = f.author_id
   order by f.created_at desc;
end
$$;

-- Sending an idea or a problem. The author's vote comes with it. At most 10 a day each, to keep
-- the list readable.
create function public.submit_feedback(p_kind text, p_title text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_title text := btrim(coalesce(p_title, ''));
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('IDEA', 'PROBLEM') then
    raise exception 'Idea or problem?' using errcode = '22023', hint = 'BAD_KIND';
  end if;
  if char_length(v_title) not between 3 and 120 then
    raise exception 'Title must be 3 to 120 characters' using errcode = '22023', hint = 'BAD_TITLE';
  end if;
  if char_length(v_details) > 1000 then
    raise exception 'Details must be at most 1000 characters' using errcode = '22023', hint = 'BAD_DETAILS';
  end if;
  if (select count(*) from public.feedback f
       where f.author_id = v_uid and f.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too much feedback today' using errcode = '22023', hint = 'TOO_MANY';
  end if;

  insert into public.feedback (author_id, kind, title, details)
  values (v_uid, p_kind, v_title, v_details)
  returning id into v_id;
  insert into public.feedback_votes (feedback_id, user_id) values (v_id, v_uid);
  return v_id;
end
$$;

-- An upvote, or taking it back. Says what to set rather than toggling, so a double tap can't
-- undo itself. Only open and planned items take votes. Returns the new count.
create function public.vote_feedback(p_feedback_id uuid, p_vote boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_member();
  v_status text;
begin
  select f.status into v_status from public.feedback f where f.id = p_feedback_id;
  if not found then
    raise exception 'No such feedback' using errcode = 'P0002';
  end if;
  if v_status not in ('OPEN', 'PLANNED') then
    raise exception 'Voting has closed' using errcode = '22023', hint = 'CLOSED';
  end if;

  if p_vote then
    insert into public.feedback_votes (feedback_id, user_id)
    values (p_feedback_id, v_uid)
    on conflict do nothing;
  else
    delete from public.feedback_votes v where v.feedback_id = p_feedback_id and v.user_id = v_uid;
  end if;
  return (select count(*) from public.feedback_votes v where v.feedback_id = p_feedback_id);
end
$$;

-- An admin marks an item open, planned, done or declined, with an optional reply. Called by the
-- server with the secret key, like the other admin actions.
create function public.admin_update_feedback(
  p_admin_id uuid,
  p_feedback_id uuid,
  p_status text,
  p_reply text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  perform private.require_admin(p_admin_id);
  if p_status is null or p_status not in ('OPEN', 'PLANNED', 'DONE', 'DECLINED') then
    raise exception 'Unknown status' using errcode = '22023', hint = 'BAD_STATUS';
  end if;
  if char_length(v_reply) > 500 then
    raise exception 'Reply must be at most 500 characters' using errcode = '22023', hint = 'BAD_REPLY';
  end if;
  update public.feedback f set status = p_status, admin_reply = v_reply where f.id = p_feedback_id;
  if not found then
    raise exception 'No such feedback' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function private.require_member() from public, anon;
revoke execute on function public.list_feedback() from public, anon;
revoke execute on function public.submit_feedback(text, text, text) from public, anon;
revoke execute on function public.vote_feedback(uuid, boolean) from public, anon;
revoke execute on function public.admin_update_feedback(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.list_feedback() to authenticated;
grant execute on function public.submit_feedback(text, text, text) to authenticated;
grant execute on function public.vote_feedback(uuid, boolean) to authenticated;
grant execute on function public.admin_update_feedback(uuid, uuid, text, text) to service_role;
