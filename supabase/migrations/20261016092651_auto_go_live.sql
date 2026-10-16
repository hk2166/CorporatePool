-- Automatic go-live (T-3.3, F-B3): owners who drive the same route most days don't even need
-- the evening tap. Every day at 17:00 in India, a job inside the database puts up the next
-- day's ride for every usual ride set to go live on that weekday.

-- ---------------------------------------------------------------------------------------------
-- Skipped days: "not tomorrow" before the job has run. (After it has run, skipping is
-- cancelling the ride, which also tells any riders.) Written by the server only.

create table public.usual_ride_skips (
  usual_ride_id uuid not null references public.usual_rides (id) on delete cascade,
  day date not null,                           -- in India
  created_at timestamptz not null default now(),
  primary key (usual_ride_id, day)
);

alter table public.usual_ride_skips enable row level security;
revoke all on public.usual_ride_skips from anon;
revoke insert, update, delete on public.usual_ride_skips from authenticated;

-- Owners can see their own skips (the home page shows "Tomorrow skipped · Undo").
create policy "Owners see their own skipped days"
  on public.usual_ride_skips for select to authenticated
  using (
    exists (
      select 1 from public.usual_rides u
       where u.id = usual_ride_skips.usual_ride_id and u.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------------------------
-- The job. For the given day (by default tomorrow in India), goes live for every usual ride
-- whose weekday is ticked, unless the owner skipped that day or already has a ride for it,
-- including a cancelled one: a cancelled day stays cancelled, so running twice never brings it
-- back. One owner's problem (say, no phone number yet) doesn't stop the others.

create function public.run_auto_go_live(p_day date default null)
returns integer                                -- how many rides were created
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'Asia/Kolkata')::date + 1);
  -- Monday = 1, Tuesday = 2, Wednesday = 4 … Sunday = 64, as in usual_rides.auto_golive_days.
  v_bit integer := 1 << (extract(isodow from v_day)::integer - 1);
  v_usual record;
  v_result record;
  v_created integer := 0;
begin
  for v_usual in
    select u.id, u.owner_id
      from public.usual_rides u
     where u.auto_golive_days & v_bit <> 0
       and not exists (
         select 1 from public.usual_ride_skips s
          where s.usual_ride_id = u.id and s.day = v_day
       )
       and not exists (
         select 1 from public.rides r
          where r.usual_ride_id = u.id
            and (r.depart_at at time zone 'Asia/Kolkata')::date = v_day
       )
  loop
    begin
      select * into v_result from public.go_live(v_usual.owner_id, v_usual.id, v_day);
      if v_result.created then
        v_created := v_created + 1;
        insert into public.notifications_outbox (user_id, kind, payload)
        values (v_usual.owner_id, 'ride_auto_live',
                jsonb_build_object('ride_id', v_result.ride_id, 'day', v_day));
      end if;
    exception when others then
      raise warning 'auto go-live skipped usual ride %: %', v_usual.id, sqlerrm;
    end;
  end loop;
  return v_created;
end
$$;

revoke execute on function public.run_auto_go_live(date) from public, anon, authenticated;
grant execute on function public.run_auto_go_live(date) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Every day at 17:00 India time (11:30 UTC): early enough that riders see tomorrow's rides
-- before the 22:00 allocation.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'auto-go-live',
  '30 11 * * *',
  $job$select public.run_auto_go_live()$job$
);
