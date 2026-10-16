-- "Pickup in 15 minutes" (T-6.4, F-E3): a reminder to each confirmed rider before their pickup,
-- and to the owner before the car sets off. A job checks every 5 minutes, so reminders arrive
-- 10 to 15 minutes ahead. Each booking and ride remembers it was reminded, so running the job
-- again (or twice in a row) never sends the same reminder twice.

alter table public.bookings add column reminded_at timestamptz;
alter table public.rides add column reminded_at timestamptz;

create function public.run_reminders()
returns integer                                -- how many reminders were written
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_riders integer;
  v_owners integer;
begin
  -- Riders: their own stop and time, not the car's departure.
  with due as (
    update public.bookings b
       set reminded_at = now()
      from public.rides r, public.ride_stops s
     where r.id = b.ride_id
       and s.ride_id = b.ride_id and s.seq = b.pickup_seq
       and b.status = 'CONFIRMED'
       and b.reminded_at is null
       and r.status in ('OPEN', 'FULL', 'STARTED')
       and r.depart_at + make_interval(mins => s.eta_offset_min)
           between now() and now() + interval '15 minutes'
    returning b.id, b.rider_id, b.ride_id, s.label,
              r.depart_at + make_interval(mins => s.eta_offset_min) as pickup_at
  )
  insert into public.notifications_outbox (user_id, kind, payload)
  select d.rider_id, 'reminder',
         jsonb_build_object('booking_id', d.id, 'ride_id', d.ride_id, 'stop', d.label,
                            'pickup_at', d.pickup_at)
    from due d;
  get diagnostics v_riders = row_count;

  -- Owners with at least one rider: time to set off, and to tap Start.
  with due as (
    update public.rides r
       set reminded_at = now()
     where r.reminded_at is null
       and r.status in ('OPEN', 'FULL')
       and r.depart_at between now() and now() + interval '15 minutes'
       and exists (
         select 1 from public.bookings b where b.ride_id = r.id and b.status = 'CONFIRMED'
       )
    returning r.id, r.owner_id, r.depart_at,
              (select count(*) from public.bookings b
                where b.ride_id = r.id and b.status = 'CONFIRMED') as riders
  )
  insert into public.notifications_outbox (user_id, kind, payload)
  select d.owner_id, 'owner_reminder',
         jsonb_build_object('ride_id', d.id, 'depart_at', d.depart_at, 'riders', d.riders)
    from due d;
  get diagnostics v_owners = row_count;

  return v_riders + v_owners;
end
$$;

revoke execute on function public.run_reminders() from public, anon, authenticated;
grant execute on function public.run_reminders() to service_role;

select cron.schedule('pickup-reminders', '*/5 * * * *', $job$select public.run_reminders()$job$);
