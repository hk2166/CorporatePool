# Low-level design

The data model and the logic behind search, seat allocation, the reliability score and "no car
goes empty". Everything here follows from [features.md](features.md); when a feature changes,
this file changes after it.
The whole model as one picture: [db-diagram.md](db-diagram.md).

## Data model

```
users(id, name, photo_url, phone, gender?, upi_vpa?, is_admin,
      home_place_id?, work_place_id?,                  -- usual commute (F-A6)
      reliability_score, rides_completed, no_shows_90d, late_cancels_90d)

cars(id, owner_id → users, model, colour, plate, seats_total, photo_urls text[])

places(id, name, geo geography(Point), kind: landmark|metro|office|town, use_count)

usual_rides(id, owner_id, car_id, depart_time, seats_offered, price_per_seat,
            notes, auto_golive_days int,               -- bitmask Mon..Sun, 0 = manual (F-B3)
            stops jsonb)                               -- [{place_id|geo, label, eta_offset_min}]

rides(id, owner_id, car_id, usual_ride_id?, depart_at timestamptz,
      seats_total, seats_left, price_per_seat, notes, women_only bool,
      status: OPEN|ALLOCATING|FULL|STARTED|COMPLETED|CANCELLED,
      allocation_at timestamptz)                       -- when ranked allocation runs (Q4)
   UNIQUE(usual_ride_id, depart_at)                    -- auto go-live can never duplicate a day

ride_stops(ride_id, seq, place_id?, geo geography(Point), label, eta_offset_min)
   PRIMARY KEY(ride_id, seq)

bookings(id, ride_id, rider_id, pickup_seq, drop_seq, seats, any_car_ok bool,
         status: REQUESTED|CONFIRMED|WAITLISTED|DECLINED|CANCELLED|EXPIRED|COMPLETED|NO_SHOW,
         waitlist_rank?, created_at, decided_at)
   UNIQUE(ride_id, rider_id) WHERE status IN ('REQUESTED','CONFIRMED','WAITLISTED')

reliability_events(id, user_id, booking_id, kind: COMPLETED|NO_SHOW|LATE_CANCEL|OWNER_LATE_CANCEL,
                   points, created_at, disputed bool, resolved_by?)   -- the score's audit trail

reviews(booking_id, from_user, to_user, stars, comment)               -- v1.1
reports(id, by_user, about_user, ride_id?, reason, status)
push_subscriptions(user_id, endpoint, p256dh, auth)
notifications_outbox(id, user_id, kind, payload jsonb, status, created_at)  -- written in the same
                                                   -- transaction, drained by the push sender (§6)
```

Why it's shaped this way:

- **`usual_rides` vs `rides`:** the template the owner edits once vs the actual post for one
  morning. **Go live** copies the template into a `rides` row (D7); the unique constraint makes
  auto go-live idempotent — run it twice, get one ride.
- **`cars` is its own table** so the one-time setup (photos, plate — F-A3) is stored once, and an
  owner can later have two cars.
- **The score has an audit trail** (`reliability_events`), not just a number on `users`, so a
  rider can see exactly why their score is what it is (F-F4) and dispute a specific event
  (F-F5). The columns on `users` are a cached rollup, recomputed by the daily job.
- **`any_car_ok`** on the booking is what lets cross-car matching move a rider (F-D6) without
  asking again.

## Status flows

```
Ride:    OPEN ──window closes──▶ ALLOCATING ──seats handed out──▶ OPEN or FULL
         OPEN ⇄ FULL  (cancellation reopens a seat)
         OPEN|FULL → STARTED → COMPLETED        OPEN|FULL → CANCELLED (riders re-matched)

Booking: REQUESTED ─┬─▶ CONFIRMED ──▶ COMPLETED | NO_SHOW | CANCELLED
                    ├─▶ WAITLISTED ──▶ CONFIRMED (promotion) | EXPIRED (at departure)
                    └─▶ DECLINED (veto, v1.1) | EXPIRED
```

## 1. Search — "Palwal → Shankar Chowk, tomorrow 8–9" (F-C1)

A ride matches if it has a stop within 2 km of the rider's pickup and a **later** stop within
2 km of their drop. The `d.seq > p.seq` is what keeps cars going the opposite direction out of
the results.

```sql
SELECT DISTINCT ON (r.id) r.*, p.seq AS pickup_seq, d.seq AS drop_seq,
       ST_Distance(p.geo, :from) + ST_Distance(d.geo, :to) AS walk_m
FROM rides r
JOIN ride_stops p ON p.ride_id = r.id
JOIN ride_stops d ON d.ride_id = r.id AND d.seq > p.seq
WHERE r.status IN ('OPEN','ALLOCATING')          -- can still request during the window
  AND r.seats_left > 0
  AND r.depart_at BETWEEN :t_lo AND :t_hi
  AND ST_DWithin(p.geo, :from, 2000)
  AND ST_DWithin(d.geo, :to, 2000)
ORDER BY r.id, walk_m;
-- then rank: walking distance + time fit + owner rating; GiST index on ride_stops.geo
```

At our scale this runs in milliseconds and costs no API calls.

## 2. The last seat

Never read-then-write a seat count. The count changes only through one conditional `UPDATE`,
inside the same transaction that confirms a booking:

```sql
UPDATE rides
SET seats_left = seats_left - :n,
    status = CASE WHEN seats_left - :n = 0 THEN 'FULL' ELSE status END
WHERE id = :ride_id AND status = 'OPEN' AND seats_left >= :n
RETURNING seats_left;
-- no row returned ⇒ the seat is gone: the booking becomes WAITLISTED instead
```

Two riders tapping in the same second: Postgres serialises the two updates; the second finds
`seats_left = 0`, matches no row, and that rider is waitlisted. The seat count the app shows is
therefore always real (F-D5), and Supabase Realtime streams the new value to every open ride
page (F-C3). A cancellation is the mirror image: `seats_left + :n`, FULL back to OPEN, then
promotion (§5).

## 3. Reliability score (F-F3)

Requirements: reward turning up, punish no-shows hardest, let people recover, stay explainable
on one screen (D10).

```
score = 50                                   -- everyone starts in the middle
      + 2 × rides completed (capped at +40)  -- regulars rise to the top
      − 15 × no-shows        in the last 90 days
      − 5 × late cancels     in the last 90 days   (late = after :cutoff, see Q6)
clamped to 0..100
```

- Stored as `reliability_events` rows; the daily job recomputes the cached score (90-day decay
  falls out naturally because old events age past the window).
- A new user starts at 50: below proven regulars, above anyone with a recent no-show. (Open
  point #2 in features.md.)
- One no-show costs about a week's worth of commuting to earn back — painful, recoverable.
- v1.1 adds the same treatment for owners (`OWNER_LATE_CANCEL`, F-F6) and disputes that void an
  event (F-F5).

## 4. Seat allocation (F-D2/D3, Q4 option A as proposed)

A ride goes live in the evening and collects requests until `allocation_at` (default 10 PM, per
Q6). Then:

```
allocate(ride):                          # pg_cron, every 5 min, for rides past allocation_at
  lock the ride row (SELECT … FOR UPDATE)
  requests = bookings REQUESTED, ordered by (reliability_score DESC, created_at ASC)
  for each request while seats remain:   confirm it   (the §2 UPDATE, same transaction)
  for the rest:                          WAITLISTED with waitlist_rank in the same order
  ride.status = FULL if seats_left = 0 else OPEN
  notify everyone (confirmed / waitlisted #n)
```

- Requests **after** the window: instant-confirm while seats remain (F-D3), else straight to the
  waitlist. So the ranking bites exactly when seats are scarce, which is what D9 asks for.
- `created_at` breaks score ties, so among equals it's first-come.
- The whole thing is one transaction per ride; at 300 rides/day this is trivial load.

## 5. No car goes empty (F-D4, F-D6)

Two mechanisms, one goal:

**Waitlist promotion** — fires in the cancellation API call, with the 5-minute sweep as the
safety net:

```
on seat freed(ride):
  next = lowest waitlist_rank on ride
  if next: confirm it (§2 UPDATE), notify "You're in"
```

**Cross-car matching** — for riders who are waitlisted (or whose ride was cancelled) and ticked
`any_car_ok`:

```
rematch(booking):
  candidates = search(§1) with the booking's pickup/drop/time, seats_left > 0,
               excluding rides the rider already has a booking on
  best = candidate minimising (walk_m, |Δ depart time|)
  if best: move the booking there, confirm, notify "Placed in the 8:15 instead"
  else:    keep WAITLISTED; ride alerts (F-C6) catch new go-lives
```

Both are plain functions over the same search query — no new infrastructure.

## 6. Modules

```
SearchService          §1; takes a MatchStrategy so the matcher can be swapped
  ├─ StopProximityMatcher      (v1, the SQL above)
  └─ RoutePolylineMatcher      (v2, ST_LineLocatePoint on a road line)
RideService            usual-ride template, go live (copy template → ride), edit, cancel
AllocationService      §2, §4, §5 — the only code allowed to touch seats_left
ReliabilityService     §3 — appends events, recomputes scores, serves "why is my score X"
NotificationService    subscribes to events (SeatConfirmed, Waitlisted, Promoted, RideCancelled,
                       RideFull…); channels: WebPush now, Email later
AdminService           rankings (F-G1), occupancy (F-G2), reports (F-G4)
PricingPolicy          suggested cost-share price (F-B6)
```

Services communicate by events (a `notifications_outbox` table written in the same transaction,
drained by the push sender), so AllocationService never knows how a push gets sent — and a crash
between "seat confirmed" and "push sent" loses nothing.

## 7. API

```
Auth      (Supabase handles sign-in; our API trusts its JWT)
GET   /places?q=palwal
GET   /rides/search?from=lat,lng&to=lat,lng&window=08:00-09:00&date=2026-10-13
GET   /rides/:id                      public — powers the WhatsApp preview card (F-H1)
POST  /cars                PATCH /cars/:id
POST  /usual-rides         PATCH /usual-rides/:id
POST  /usual-rides/:id/golive        body: {date, overrides?}        → the one tap (F-B2)
PATCH /rides/:id                     edit | cancel | start | complete
POST  /rides/:id/bookings            body: {pickup_seq, drop_seq, seats, any_car_ok}
PATCH /bookings/:id                  cancel | no_show | picked_up
GET   /me                  /me/rides   /me/bookings   /me/reliability
POST  /push/subscribe      POST /reports
GET   /admin/rankings      /admin/occupancy           POST /admin/actions
```

## 8. Failure cases worth designing for

| Case | Handling |
|---|---|
| Owner never marks the ride completed | Expiry job completes it 3 h after departure; riders not marked no-show count as COMPLETED (so forgetting never hurts riders) |
| Rider requests two overlapping rides | Allowed until one confirms; confirming one auto-cancels the other REQUESTED/WAITLISTED (partial unique index makes dupes per ride impossible) |
| Owner cancels after allocation | All bookings → re-match (§5); OWNER_LATE_CANCEL event if past the cutoff |
| Push fails / user has no push | The outbox retries; the app shows the same state on next open — push is a convenience, the DB is the truth |
| pg_cron misses a tick | Every job is idempotent and picks up where it left off (keyed on `allocation_at`, `depart_at` windows) |
