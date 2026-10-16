-- Keeping the free Supabase project awake, and tidy.
--
-- Awake: a free project pauses after about a week without database activity. The database's
-- own jobs run every minute, and Vercel's daily cron calls /api/jobs/keep-warm; that call now
-- writes too (keep_alive: one row's timestamp, updated in place), so the project sees a real
-- write from outside every day, whatever counts as activity.
--
-- Tidy: a daily job deletes what's only useful for a short while, once it's more than 2 days
-- old: the jobs' run log (the one table that grows by itself, a few thousand rows a day),
-- notifications already sent or given up on, ended invite links, skipped days that have
-- passed, and stop and join requests already dealt with. Rejected join requests stay, so a
-- rejection sticks. Daily activity is kept for 120 days (the dashboard looks back 90).
-- Members, stops, cars, rides, bookings, reliability history, reports, feedback and the admin
-- trail are never touched.

create table private.keep_alive (
  id smallint primary key default 1 check (id = 1),
  beat_at timestamptz not null default now()
);

create function public.keep_alive()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  insert into private.keep_alive (id, beat_at) values (1, now())
  on conflict (id) do update set beat_at = excluded.beat_at
  returning beat_at
$$;

create function public.run_housekeeping()
returns jsonb                                  -- how many rows each step deleted
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := now() - interval '2 days';
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_counts jsonb := '{}';
  v_n integer;
begin
  delete from cron.job_run_details d where d.end_time < v_cutoff;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('job_runs', v_n);

  delete from public.notifications_outbox o where o.created_at < v_cutoff;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('notifications', v_n);

  delete from public.signup_tokens t where t.expires_at < v_cutoff;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('invites', v_n);

  delete from public.usual_ride_skips s where s.day < v_today - 2;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('skips', v_n);

  delete from public.stop_requests r where r.status <> 'PENDING' and r.decided_at < v_cutoff;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('stop_requests', v_n);

  delete from public.join_requests r where r.status = 'ACCEPTED' and r.decided_at < v_cutoff;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('join_requests', v_n);

  delete from public.member_activity a where a.day < v_today - 120;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('activity', v_n);

  return v_counts;
end
$$;

revoke execute on function public.keep_alive() from public, anon, authenticated;
revoke execute on function public.run_housekeeping() from public, anon, authenticated;
grant execute on function public.keep_alive() to service_role;
grant execute on function public.run_housekeeping() to service_role;

-- 22:00 UTC is 03:30 in India, when nothing else is going on.
select cron.schedule('housekeeping', '0 22 * * *', $job$select public.run_housekeeping()$job$);
