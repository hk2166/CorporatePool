-- Sending pushes (T-6.3, F-E1, F-E2, lld.md §6).
--
-- Every notification is already written to notifications_outbox in the same transaction as the
-- change it announces. The push sender (app/api/jobs/send-pushes, part of the app) claims a batch of
-- pending rows, sends them with Web Push, and reports back which were sent. A crash anywhere in
-- between loses nothing: a claim expires after 2 minutes and the rows go out on a later run,
-- up to 10 tries in all.
--
-- The database wakes the sender itself, through pg_net: straight after new notifications are
-- written, and every minute while any are waiting. Where the app lives and the secret its job
-- routes expect (CRON_SECRET) are kept in Supabase Vault, set once per environment
-- (docs/setup.md):
--
--   select vault.create_secret('https://<the app>', 'app_url');
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
--
-- Until both exist, notifications simply wait in the outbox.

create extension if not exists pg_net with schema extensions;

alter table public.notifications_outbox add column claimed_until timestamptz;

-- ---------------------------------------------------------------------------------------------
-- The sender's side. Claims up to p_limit pending notifications, oldest first, that nobody else
-- is working on. Concurrent senders never get the same row (skip locked).

create function public.claim_notifications(p_limit integer default 50)
returns table (id uuid, user_id uuid, kind text, payload jsonb, attempts smallint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows that used their last try and never came back are given up on.
  update public.notifications_outbox o
     set status = 'FAILED', claimed_until = null
   where o.status = 'PENDING' and o.attempts >= 10 and o.claimed_until < now();

  return query
  with claimed as (
    update public.notifications_outbox o
       set attempts = o.attempts + 1, claimed_until = now() + interval '2 minutes'
     where o.id in (
       select x.id from public.notifications_outbox x
        where x.status = 'PENDING'
          and x.attempts < 10
          and (x.claimed_until is null or x.claimed_until < now())
        order by x.created_at
        limit greatest(1, least(p_limit, 500))
        for update skip locked
     )
    returning o.id, o.user_id, o.kind, o.payload, o.attempts, o.created_at
  )
  select c.id, c.user_id, c.kind, c.payload, c.attempts from claimed c order by c.created_at;
end
$$;

-- Reports back: sent (or nothing to send to), and failed (tried again later, up to 10 tries).
create function public.finish_notifications(p_sent uuid[], p_failed uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications_outbox o
     set status = 'SENT', sent_at = now(), claimed_until = null
   where o.id = any(p_sent) and o.status = 'PENDING';
  update public.notifications_outbox o
     set status = case when o.attempts >= 10 then 'FAILED' else 'PENDING' end::public.outbox_status,
         claimed_until = null
   where o.id = any(p_failed) and o.status = 'PENDING';
$$;

revoke execute on function public.claim_notifications(integer) from public, anon, authenticated;
revoke execute on function public.finish_notifications(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.claim_notifications(integer) to service_role;
grant execute on function public.finish_notifications(uuid[], uuid[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Waking the sender. pg_net sends the request after the transaction commits, so a rolled-back
-- change never pings anyone. Returns whether a request was queued.

create function private.wake_push_sender()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'app_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s
   where s.name = 'cron_secret';
  if v_url is null or v_secret is null then
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/jobs/send-pushes',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret,
                                  'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  return true;
end
$$;

revoke execute on function private.wake_push_sender() from public;

create function private.on_notifications_written()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wake_push_sender();
  return null;
end
$$;

-- Once per statement: allocating a whole car writes many rows and needs one wake-up.
create trigger notifications_outbox_wake_sender
  after insert on public.notifications_outbox
  for each statement execute function private.on_notifications_written();

-- The retry loop: every minute, while anything is waiting.
select cron.schedule(
  'send-pushes',
  '* * * * *',
  $job$select private.wake_push_sender()
         where exists (select 1 from public.notifications_outbox where status = 'PENDING')$job$
);
