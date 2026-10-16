# High-level design

How the app is put together so that it costs ₹0 to run and one person can look after it.

## Expected load

A WhatsApp group holds at most 1,024 people. Even five groups ≈ 5,000 users, 200–300 live rides a
day, and a burst of searches and requests around 8–10 PM (go-live + booking) and 7–9 AM
(reminders, no-shows, same-day requests). Perhaps 1–2 requests a second at the very peak.

**Conclusion:** one Postgres database and one web app handle this with room to spare. So: **one
app with clean internal modules — no microservices, no message queue, no Redis.** The interesting
complexity (allocation, scoring) lives in code and SQL, not in infrastructure.

## Architecture

```
  Phone (installable PWA) ──share ride link──▶ WhatsApp group ──tap──▶ ride page
       │ HTTPS
       ▼
  Vercel · Next.js (UI + API routes)
    ├─ Search module        from → to → when, only cars that fit
    ├─ Ride module          usual-ride template, go live, edit, cancel
    ├─ Allocation module    seats, ranking, waitlist, cross-car matching
    ├─ Reliability module   score from no-shows / late cancels / completed rides
    ├─ Notification module  web push, reacting to events
    └─ Admin module         rankings, occupancy, reports
       │
       ▼
  Supabase (free tier)
    ├─ Postgres + PostGIS   all data; geo queries for "stop near me"
    ├─ Auth                 Google sign-in
    ├─ Storage              car photos
    ├─ Realtime             live seat counts on open ride pages
    └─ pg_cron (+ pg_net → app)     scheduled jobs, below
       │
  Other free services
    ├─ MapLibre + OpenFreeMap   map tiles, no API key
    ├─ Photon (OSM)             place search fallback beyond the landmark list
    └─ Web Push (VAPID)         notifications, free, no Firebase needed
```

| Layer | Choice | Free-tier catch |
|---|---|---|
| Frontend + API | Next.js PWA on Vercel Hobby | Non-commercial use only — fits, the app earns nothing. Vercel cron is daily-only on Hobby, so frequent jobs run in the database instead (below). |
| Database | Supabase Postgres + PostGIS | 500 MB storage and 1 GB file storage — years of data at this size. Project pauses after ~7 days of no activity; a daily job keeps it warm. |
| Login | Supabase Auth with Google | Phone-OTP login costs money per SMS, so we don't use it. |
| Car photos | Supabase Storage | Resize on upload (~200 KB each) so 1 GB lasts. |
| Maps | MapLibre + OpenFreeMap | No key, no quota. |
| Push | Web Push with VAPID keys | Free. On iPhone, only after the app is added to the home screen. |

Free-tier limits change often; re-check each one before building on it. Everything here is
portable (plain Postgres, a standard React/Next.js app), so moving host is a day's work, not a
rewrite.

## The three big calls

1. **Ride with WhatsApp, don't fight it.** Every ride gets a public link (`/r/abc123`) that
   renders a preview card in the group. The group stays the announcement board; the app becomes
   the booking desk. This is the adoption plan (D5).
2. **Rides are ordered landmark stops, not road polylines (D11).** Search is pure PostGIS
   ("a stop within 2 km of my pickup, and a later stop within 2 km of my drop"), costing zero
   API calls. Matching against the actual road line is a v2 upgrade with the same interface.
3. **Nothing of ours stays running.** Serverless functions + a hosted database + jobs inside
   Postgres. Free always-on servers barely exist (Render's free tier sleeps and takes ~50 s to
   wake — right at 8:29 AM). This stack has no server to sleep.

## Scheduled jobs

Vercel Hobby cron runs at most daily, so timing-sensitive jobs live in the database with
**pg_cron**. When a job needs the outside world (sending pushes), the database calls the app's
own `/api/jobs/*` routes through **pg_net** with a shared secret (`CRON_SECRET`, kept in
Supabase Vault). That keeps one codebase and one deploy instead of a separate Edge Function.

| Job | When | What it does |
|---|---|---|
| Auto go-live | daily, evening | Creates tomorrow's rides for owners with automatic go-live (F-B3) |
| Allocation | every 5 min | Runs ranked allocation for rides whose window just closed (Q4 option A) |
| Waitlist sweep | every 5 min | Promotes waitlisted riders into any seats opened by cancellations; cross-car offers (F-D6) |
| Reminders | every 5 min | "Pickup in 15 minutes" pushes (F-E3) |
| Push sender | right after notifications are written, and every minute while any wait | Wakes `/api/jobs/send-pushes`, which sends the outbox with Web Push; retried up to 10 times (lld.md §6) |
| Expiry | every 5 min | Expires unanswered requests at departure; completes rides 3 hours after departure |
| Score refresh | daily | Recomputes reliability scores with the 90-day decay (F-F3) |
| Keep-warm | daily | Touches the DB so the free project never pauses |

Promotion on cancellation also fires immediately in the API call itself; the sweep is the safety
net, so a missed event never strands an empty seat.

## Where the "automatic" lives

The user-visible promise — *live seat counts, reliable riders first, no car leaves empty* — maps
to three mechanisms:

| Promise | Mechanism | Detail in |
|---|---|---|
| Seat counts always right | One conditional `UPDATE` in the booking transaction; Realtime pushes the new count to open pages | [lld.md §2](lld.md#2-the-last-seat) |
| Reliable riders first | Reliability score + ranked allocation at the window close; score orders the waitlist too | [lld.md §3–4](lld.md#3-reliability-score) |
| No car goes empty | Waitlist auto-promotion + cross-car matching for "any car is fine" riders | [lld.md §5](lld.md#5-no-car-goes-empty) |

## Security and privacy, briefly

- Postgres Row-Level Security: phone numbers, plates and photos are only readable by parties to
  a confirmed booking on that ride; scores are readable by their owner and the admin.
- The public ride link shows route, time, price, seats left and the owner's first name — nothing
  contactable.
- Admin actions (remove user, hide ride) are ordinary rows with an audit trail.
