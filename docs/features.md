# Features

Every feature the app might have, so we can agree on what goes into each version.

**Priority**
- **v1**: needed for the first launch on one route (Palwal → Gurgaon)
- **v1.1**: soon after launch, once people are using it
- **Later**: good ideas that can wait
- **?**: depends on an open question in [decisions.md](decisions.md)

**Status:** every feature starts as *Proposed*. Once we agree, it becomes *Agreed* or *Dropped*,
and the reason goes into [decisions.md](decisions.md).

## v1 in one line

> Commuters sign up once and search a route like a cab app; car owners set up the car once and go
> live with one tap each evening; the app hands out seats automatically, reliable riders first,
> keeps the counts live, and fills cancelled seats from the waitlist, so no car leaves empty.

---

## A. Accounts, profiles and cars

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-A1 | Sign in with Google | v1 | Proposed | Free. Login by phone needs SMS codes, which cost money per message. |
| F-A2 | Profile: name, photo, phone number | v1 | Proposed | Phone is required but shown only after a seat is confirmed (F-F1). Not verified by SMS. |
| F-A3 | One-time car setup: photos, model, colour, number plate, seats | v1 | Proposed | Done once. Photos and plate are shown to confirmed riders so they find the right car. |
| F-A4 | One account can be both commuter and car owner | v1 | Proposed | Same person may ride Monday and drive Tuesday. |
| F-A5 | UPI ID on the owner's profile | v1 | Proposed | Optional. Powers the pay button (F-D8). |
| F-A6 | Usual pickup and office stops on the commuter's profile | v1 | Proposed | Landmarks, not exact addresses. Powers one-tap search (F-C1). |
| F-A7 | Verified work-email badge ("Works at abc.com") | v1.1 | Proposed | Free email link to the work address; we show the domain, never the email. |
| F-A8 | Driver type: own car or cab operator | ? | Proposed | Depends on [Q1](decisions.md#q1-who-are-the-drivers). |
| F-A9 | Delete my account and data | v1 | Proposed | Basic privacy. |

## B. Going live (car owner)

The owner's daily job must be one tap. Everything slow happens once, at setup.

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-B1 | Usual ride saved once: ordered stops, departure time, seats offered, price per seat, notes (AC, luggage) | v1 | Proposed | Stops picked from a landmark list or by dropping a pin. |
| F-B2 | **Go live** in one tap, the evening before or the same day | v1 | Proposed | Posts tomorrow's (or today's) ride from the usual ride. Time and seats can be tweaked before posting. |
| F-B3 | Automatic go-live on chosen weekdays, with skip-a-day | v1 | Proposed | For owners who drive every day. Skipping notifies anyone already allocated. |
| F-B4 | Edit or cancel a live ride; affected riders are notified and re-matched | v1 | Proposed | Re-matching is F-D6. |
| F-B5 | Return trip in one tap (stops reversed, evening time) | v1.1 | Proposed | |
| F-B6 | Suggested price based on distance | v1.1 | Proposed | Keeps it cost-sharing. The owner can change it. See [Q5](decisions.md#q5-pricing). |
| F-B7 | "Leaving now" / "Running 10 min late" message to all confirmed riders | v1.1 | Proposed | A very common message in the groups today. |
| F-B8 | Mark the ride started and completed; mark riders picked up or no-show | v1 | Proposed | Feeds the reliability score (F-F3), so it must be in v1. |
| F-B9 | Paste a WhatsApp ride message and the form fills itself | Later | Proposed | Needs an AI model on a free tier. |

## C. Finding a seat (commuter)

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-C1 | Search like a cab app: from, to, date, time window — e.g. *Palwal → Shankar Chowk, tomorrow, 8–9* | v1 | Proposed | Shows only cars that fit: a stop near the pickup, a later stop near the drop, time in window, seats left. Sorted by best fit. |
| F-C2 | One-tap search from the saved route ("my usual commute, tomorrow") | v1 | Proposed | Uses F-A6. |
| F-C3 | Live seat counts on every ride card | v1 | Proposed | Updates in front of you as seats fill. |
| F-C4 | "Any car that fits is fine" when requesting | v1 | Proposed | Lets the app place you in whichever matching car has room (F-D6). |
| F-C5 | Filters: time, price, seats together, AC, women-only | v1.1 | Proposed | |
| F-C6 | Ride alert: "tell me when a car matches X → Y, 8–9" | v1.1 | Proposed | |
| F-C7 | Seat request board: "need a seat tomorrow 8:30, X → Y" visible to owners | v1.1 | Proposed | Groups have these posts today; also feeds F-D6. |
| F-C8 | Map of the route and pickup points | v1.1 | Proposed | Free map tiles, no API key. |

## D. Seats and automatic allocation

The heart of the app. Nobody manages seats by hand; see [lld.md](lld.md#seat-allocation) for the
mechanics.

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-D1 | Request seats with a pickup stop and a drop stop | v1 | Proposed | A request does not hold a seat. |
| F-D2 | Automatic allocation: when requests outnumber seats, the most reliable commuters get them | v1 | Proposed | Ranked by the reliability score (F-F3). How the timing window works is [Q4](decisions.md#q4-how-allocation-works). |
| F-D3 | Instant confirmation while seats are free and the ride is not oversubscribed | v1 | Proposed | Exact interplay with F-D2 is part of Q4. |
| F-D4 | Waitlist, ordered by reliability, with automatic promotion when a seat opens | v1 | Proposed | A confirmed rider cancels → the next waitlisted rider is confirmed and notified, automatically. |
| F-D5 | Seat counts always correct: every confirm/cancel updates the count in the same transaction | v1 | Proposed | Two riders can never get the same seat. See [lld.md](lld.md#2-the-last-seat). |
| F-D6 | Cross-car matching: riders left over on a full car are offered seats in other matching cars | v1 | Proposed | "No car goes empty while someone is waiting." Uses F-C4. |
| F-D7 | Rider cancels a booking; owner cancels a ride; everyone affected is notified and re-matched | v1 | Proposed | Late cancels feed the score (F-F3). |
| F-D8 | After confirmation: call and WhatsApp buttons, car photos and plate, UPI pay link with the amount filled in | v1 | Proposed | Replaces in-app chat and payments. |
| F-D9 | Weekly booking: "book me Mon–Fri on this ride" | Later | Proposed | |
| F-D10 | Owner veto: block a specific rider from their car | v1.1 | Proposed | Allocation is automatic, but an owner must be able to refuse someone. See Q4. |

## E. Notifications

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-E1 | Push: seat confirmed, waitlisted, promoted from waitlist, ride cancelled, ride edited | v1 | Proposed | Web push is free. On iPhone it works only after "Add to Home Screen". |
| F-E2 | Push to the owner: "your car is full", "2 seats still free at 9 PM" | v1 | Proposed | |
| F-E3 | Reminder 15 minutes before pickup, to riders and owner | v1 | Proposed | Needs a job every few minutes; see [hld.md](hld.md#scheduled-jobs). |
| F-E4 | Alert when a ride matching a saved search goes live | v1.1 | Proposed | Goes with F-C6. |
| F-E5 | Email fallback for important events if push isn't set up | Later | Proposed | Free email tiers have small daily limits. |

## F. Reliability, trust and safety

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-F1 | Phone number, car photos and plate hidden until a seat is confirmed | v1 | Proposed | |
| F-F2 | Owner marks no-shows at pickup (part of F-B8) | v1 | Proposed | |
| F-F3 | Reliability score per commuter, computed automatically from completed rides, no-shows and late cancellations | v1 | Proposed | Drives allocation (F-D2) and the waitlist order (F-D4). Formula in [lld.md](lld.md#reliability-score); old misses stop counting after 90 days. |
| F-F4 | The score's rules are public inside the app, and your own score and history are always visible to you | v1 | Proposed | Ranking people in secret breeds distrust. |
| F-F5 | Dispute a no-show ("the car never came") | v1.1 | Proposed | Protects riders from unfair marks; disputes go to the admin. |
| F-F6 | Owner reliability too: late cancels and "car never came" count against owners | v1.1 | Proposed | Reliability must cut both ways. |
| F-F7 | Rate each other after the ride (1–5 stars) | v1.1 | Proposed | |
| F-F8 | Report and block a user | v1 | Proposed | |
| F-F9 | Share trip with family: link showing driver, car, plate, route and time | v1.1 | Proposed | |
| F-F10 | Women-only rides | v1.1 | Proposed | Owner marks the ride; only women can book. Needs an optional gender field. |
| F-F11 | Communities: rides visible only to members (a company, a society, an existing WhatsApp group) | ? | Proposed | Depends on [Q3](decisions.md#q3-who-can-join). |

## G. Admin

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-G1 | Rider ranking view: every commuter's score, no-shows, late cancels, rides completed | v1 | Proposed | What a group admin eyeballs from memory today, computed for them. |
| F-G2 | Occupancy view: seats offered vs seats filled per day and per route | v1 | Proposed | Measures "no cab goes empty". |
| F-G3 | Unmet demand view: searches and requests that found no seat | v1.1 | Proposed | Tells us where more cars are needed. |
| F-G4 | Reports queue; remove a user, hide a ride | v1 | Proposed | Someone must be able to remove a bad actor from day one. |
| F-G5 | Owners who mark unusually many no-shows are flagged | v1.1 | Proposed | Guards the score against abuse. |
| F-G6 | Manage the landmark list: add, merge and rename stops | v1 | Proposed | Needed if Q2 is "one corridor with hand-picked landmarks". |

## H. WhatsApp bridge and growth

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-H1 | Every ride has a link that shows a preview card in WhatsApp | v1 | Proposed | *Palwal → Shankar Chowk · 8:00 · 2 seats · ₹150*. The main way riders arrive at first. |
| F-H2 | Prompt to install the app on the home screen | v1 | Proposed | Needed for push on iPhone. |
| F-H3 | "Today's cars" card: one message listing all live rides on a route, to paste in the group | v1.1 | Proposed | One post instead of twenty. |
| F-H4 | Invite link | v1.1 | Proposed | |

## I. My rides

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| F-I1 | My upcoming seats and rides, with their status | v1 | Proposed | |
| F-I2 | Past rides and my reliability history | v1 | Proposed | Part of F-F4. |
| F-I3 | Monthly summary: rides given and taken, money shared | Later | Proposed | |

## Not doing

Payments inside the app, chat inside the app, live GPS tracking, native apps, and commission, ads
or surge pricing. The reasons are in [idea.md](../idea.md#not-doing-for-now).

## Points to discuss

Smaller questions that come up when reading the list. The big ones are in
[decisions.md](decisions.md).

1. F-B8 (owner marks no-shows) is the price of automatic ranking: owners get one small daily
   chore. Is that acceptable, or should "no mark = everyone showed up" be the default?
2. Should a brand-new user with no history rank above or below a long-time user with one no-show?
   (Proposed: new users start at a middle score; see lld.md.)
3. Should women-only rides (F-F10) move to v1? It may decide whether many riders join at all.
4. How late is a "late cancellation": 30 minutes before pickup? 60? The evening before?
5. Does the owner see rider names before allocation, or only after? (Full automation says only
   after; the veto F-D10 says they can at least remove someone.)
