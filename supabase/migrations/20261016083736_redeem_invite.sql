-- Invite redemption (T-2.1, Q3): turns a signed-in Google account into a member.
--
-- One function does both steps in one transaction: use up one invite, and create the profile.
-- Two people racing for the last use of an invite can't both get in: the UPDATE only succeeds
-- while uses remain, and Postgres runs the two updates one after the other.
--
-- Only the server calls it, with the secret key (app/auth/join). Signed-in users can't call it
-- directly, so nobody can create a profile without going through the invite check.

create function public.redeem_invite(
  p_token text,
  p_user_id uuid,
  p_name text,
  p_photo_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(p_name, '')), 80);
begin
  -- Already a member: nothing to redeem, and the invite isn't used up.
  if exists (select 1 from public.users where id = p_user_id) then
    return true;
  end if;

  update public.signup_tokens
     set used_count = used_count + 1
   where token = p_token
     and used_count < max_uses
     and expires_at > now();
  if not found then
    return false;
  end if;

  insert into public.users (id, name, photo_url)
  values (
    p_user_id,
    case when v_name = '' then 'New member' else v_name end,
    case when p_photo_url ~ '^https?://' then p_photo_url end
  );
  return true;
end
$$;

revoke execute on function public.redeem_invite(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_invite(text, uuid, text, text) to service_role;
