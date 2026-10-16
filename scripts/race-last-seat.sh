#!/usr/bin/env bash
# The last seat (T-5.1, lld.md §2): two riders ask for a car's last seat at the same moment,
# from two real database connections. Exactly one must get it, the other must be waitlisted,
# and the seat count must end at zero, never below.
#
# pgTAP tests run in one connection, so they can't race; this script can. It runs against the
# local Supabase database (npm run db:start, or db:start:db-only) and cleans up after itself.
#
#   npm run test:race

set -euo pipefail

# The local Supabase database's standard address; set DATABASE_URL to use another.
DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ROUNDS="${ROUNDS:-20}"

sql() { psql "$DB" -v ON_ERROR_STOP=1 -qtAX "$@"; }

OWNER=00000000-0000-0000-0000-0000000005a0
R1=00000000-0000-0000-0000-0000000005a1
R2=00000000-0000-0000-0000-0000000005a2
CAR=20000000-0000-0000-0000-0000000005a0
RIDE=30000000-0000-0000-0000-0000000005a0

cleanup() {
  sql <<SQL
delete from public.notifications_outbox where user_id in ('$OWNER', '$R1', '$R2');
delete from public.bookings where ride_id = '$RIDE';
delete from public.rides where id = '$RIDE';
delete from auth.users where id in ('$OWNER', '$R1', '$R2');
SQL
}
trap cleanup EXIT
cleanup

# An owner, two riders (all fake) and a ride whose seats are already being handed out first
# come, first served (allocation time has passed).
sql <<SQL
insert into auth.users (id, email) values
  ('$OWNER', 'demo.race.owner@example.com'),
  ('$R1', 'demo.race.one@example.com'),
  ('$R2', 'demo.race.two@example.com');
insert into public.users (id, name, phone) values
  ('$OWNER', 'Demo Race Owner', '+919999950500'),
  ('$R1', 'Demo Race One', '+919999950501'),
  ('$R2', 'Demo Race Two', '+919999950502');
insert into public.cars (id, owner_id, model, colour, plate, seats_total)
values ('$CAR', '$OWNER', 'Demo Car', 'White', 'HR26DM05A0', 4);
insert into public.rides (id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left,
                          price_per_seat)
values ('$RIDE', '$OWNER', '$CAR', now() + interval '5 hours', now() - interval '1 hour', 3, 1, 100);
insert into public.ride_stops (ride_id, seq, geo, label, eta_offset_min) values
  ('$RIDE', 0, extensions.st_makepoint(77.33, 28.14)::extensions.geography, 'Demo Race Start', 0),
  ('$RIDE', 1, extensions.st_makepoint(77.09, 28.49)::extensions.geography, 'Demo Race End', 70);
SQL

reset_round() {
  sql -c "delete from public.bookings where ride_id = '$RIDE';
          update public.rides set seats_left = 1, status = 'OPEN' where id = '$RIDE';"
}

check_round() {
  local label=$1
  local got
  got=$(sql -c "select (select string_agg(status::text, ',' order by status::text)
                          from public.bookings where ride_id = '$RIDE')
                       || ' / ' || seats_left || ' ' || status
                  from public.rides where id = '$RIDE'")
  if [[ "$got" != "CONFIRMED,WAITLISTED / 0 FULL" ]]; then
    echo "not ok - $label: got '$got', want 'CONFIRMED,WAITLISTED / 0 FULL'"
    exit 1
  fi
}

ask() { sql -c "select status from public.request_seat('$1', '$RIDE', 0::smallint, 1::smallint)"; }

# 1. Overlap guaranteed: R1's request holds its transaction open for a second, and R2 asks in the
#    middle of it. R2 must wait for R1, then find the seat gone.
reset_round
sql -c "begin; select status from public.request_seat('$R1', '$RIDE', 0::smallint, 1::smallint);
        select pg_sleep(1); commit;" > /dev/null &
sleep 0.3
second=$(ask "$R2")
wait
check_round "a request made while another holds the last seat"
[[ "$second" == "WAITLISTED" ]] || { echo "not ok - the later request got '$second'"; exit 1; }
echo "ok 1 - R2 asked while R1 was taking the last seat: R1 confirmed, R2 waitlisted, 0 left"

# 2. Truly at once, many times over: whoever wins, the outcome is always one seat, one waitlist.
for round in $(seq 1 "$ROUNDS"); do
  reset_round
  ask "$R1" > /dev/null &
  ask "$R2" > /dev/null &
  wait
  check_round "simultaneous round $round"
done
echo "ok 2 - $ROUNDS rounds of two simultaneous requests: always one confirmed, one waitlisted, 0 left"
