-- Access rules, part 3 of 3 (T-1.3): bookings, reliability_events, reviews, reports,
-- admin_actions, notifications_outbox.
-- Same model as parts 1–2: reads through RLS, rule-bound writes by the server only.

-- ---------------------------------------------------------------------------------------------
-- bookings: a rider sees their own; an owner sees the bookings on their rides; admins see all.
-- Every change goes through the server, because each one moves seats or the waitlist
-- (lld.md §2, §4, §5).

revoke all on public.bookings from anon;
revoke insert, update, delete on public.bookings from authenticated;

create policy "Riders see their own bookings"
  on public.bookings for select to authenticated
  using (rider_id = (select auth.uid()));

create policy "Owners see bookings on their rides"
  on public.bookings for select to authenticated
  using (
    exists (
      select 1 from public.rides r
       where r.id = bookings.ride_id and r.owner_id = (select auth.uid())
    )
  );

create policy "Admins see all bookings"
  on public.bookings for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- reliability_events: you see the events behind your own score (F-F4); admins see everyone's
-- (F-G1). Only the server writes them (T-6.1).

revoke all on public.reliability_events from anon;
revoke insert, update, delete on public.reliability_events from authenticated;

create policy "People see their own reliability events"
  on public.reliability_events for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins see all reliability events"
  on public.reliability_events for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- reviews: ratings are shown on profiles, so members can read them (F-F7). The server writes
-- them after checking the ride really happened and the reviewer was on it.

revoke all on public.reviews from anon;
revoke insert, update, delete on public.reviews from authenticated;

create policy "Signed-in users can read reviews"
  on public.reviews for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------
-- reports: anyone can report someone, in their own name only, and always as a new open report
-- (status and resolved_at aren't insertable). You see your own reports, never reports about
-- you. Admins see all and resolve them through the server, which also logs it in
-- admin_actions (F-F8, F-G4).

revoke all on public.reports from anon;
revoke insert, update, delete on public.reports from authenticated;
grant insert (by_user, about_user, ride_id, reason) on public.reports to authenticated;

create policy "People file reports in their own name"
  on public.reports for insert to authenticated
  with check (by_user = (select auth.uid()));

create policy "People see the reports they filed"
  on public.reports for select to authenticated
  using (by_user = (select auth.uid()));

create policy "Admins see all reports"
  on public.reports for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- admin_actions: admins read the audit trail; only the server appends to it.

revoke all on public.admin_actions from anon;
revoke insert, update, delete on public.admin_actions from authenticated;

create policy "Admins read the audit trail"
  on public.admin_actions for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- notifications_outbox: internal to the server and the push sender. Nobody reads it through
-- the API.

revoke all on public.notifications_outbox from anon, authenticated;
