-- Live seat counts (T-4.3, F-C3, lld.md §2): every change to a ride (seats left, full, cancelled)
-- is streamed to the browsers showing it, through Supabase Realtime.
--
-- Realtime checks the same access rules as a normal read before sending a change, so a ride
-- reaches only signed-in users, exactly as "Signed-in users can read rides" allows. Nothing
-- else is published.

alter publication supabase_realtime add table public.rides;
