-- The reliability score (T-6.1, F-F3, lld.md §3):
--
--   score = 50                                   everyone starts in the middle
--         + 2 × rides completed, at most +40     regulars rise to the top
--         − 15 × no-shows in the last 90 days
--         − 5 × late cancels in the last 90 days (riders after 22:00, owners after 22:00)
--   kept between 0 and 100
--
-- reliability_events is the record; the numbers on users are a cached rollup of it, which
-- allocation ranks by. They're recomputed for a person the moment one of their events is
-- added or removed, and for everyone once a night so events older than 90 days stop counting.
-- lib/reliability.ts has the same formula for the "how the score works" page.

-- The formula on its own.
create function private.reliability_score(
  p_rides_completed integer,
  p_no_shows integer,
  p_late_cancels integer
)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select greatest(0, least(100,
           50 + least(2 * p_rides_completed, 40) - 15 * p_no_shows - 5 * p_late_cancels
         ))::smallint
$$;

-- One person's numbers, from their events.
create function private.recompute_score(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users u
     set rides_completed = c.completed,
         no_shows_90d = c.no_shows,
         late_cancels_90d = c.late_cancels,
         reliability_score = private.reliability_score(c.completed, c.no_shows, c.late_cancels)
    from (
      select count(*) filter (where e.kind = 'COMPLETED')::integer as completed,
             count(*) filter (where e.kind = 'NO_SHOW'
                                and e.created_at > now() - interval '90 days')::integer as no_shows,
             count(*) filter (where e.kind in ('LATE_CANCEL', 'OWNER_LATE_CANCEL')
                                and e.created_at > now() - interval '90 days')::integer
               as late_cancels
        from public.reliability_events e
       where e.user_id = p_user_id
    ) c
   where u.id = p_user_id
$$;

revoke execute on function private.reliability_score(integer, integer, integer) from public;
revoke execute on function private.recompute_score(uuid) from public;

-- Straight away when an event is added or removed (a no-show undone, say).
create function private.on_reliability_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recompute_score(coalesce(new.user_id, old.user_id));
  return null;
end
$$;

create trigger reliability_events_recompute_score
  after insert or delete on public.reliability_events
  for each row execute function private.on_reliability_event();

-- Everyone, nightly: 03:00 in India (21:30 UTC), when nobody is booking. Returns how many
-- scores changed.
create function public.recompute_scores()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed integer;
begin
  with c as (
    select u.id,
           count(e.*) filter (where e.kind = 'COMPLETED')::integer as completed,
           count(e.*) filter (where e.kind = 'NO_SHOW'
                                and e.created_at > now() - interval '90 days')::integer as no_shows,
           count(e.*) filter (where e.kind in ('LATE_CANCEL', 'OWNER_LATE_CANCEL')
                                and e.created_at > now() - interval '90 days')::integer
             as late_cancels
      from public.users u
      left join public.reliability_events e on e.user_id = u.id
     group by u.id
  )
  update public.users u
     set rides_completed = c.completed,
         no_shows_90d = c.no_shows,
         late_cancels_90d = c.late_cancels,
         reliability_score = private.reliability_score(c.completed, c.no_shows, c.late_cancels)
    from c
   where u.id = c.id
     and (u.rides_completed, u.no_shows_90d, u.late_cancels_90d)
         is distinct from (c.completed, c.no_shows, c.late_cancels);
  get diagnostics v_changed = row_count;
  return v_changed;
end
$$;

revoke execute on function public.recompute_scores() from public, anon, authenticated;
grant execute on function public.recompute_scores() to service_role;

select cron.schedule('recompute-scores', '30 21 * * *', $job$select public.recompute_scores()$job$);
