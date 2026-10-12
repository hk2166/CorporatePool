# User flows

How people use the app for the main jobs, step by step. Feature IDs in brackets refer to
[features.md](features.md).

## 1. A commuter signs up and finds a seat

1. Opens the app link (from a friend or the WhatsApp group) and signs in with Google [F-A1].
2. Adds name, phone number, and their usual stops: pickup *Palwal bus stand*, office *Shankar
   Chowk* [F-A2, F-A6]. Takes about a minute, once.
3. Searches like a cab app: **Palwal → Shankar Chowk, tomorrow, 8–9 AM** [F-C1] — or just taps
   **My usual commute** [F-C2].
4. Sees only cars that fit, sorted by best fit: departure time, price, seats left (live),
   the owner's first name, photo and rating, and how far the nearest pickup stop is. No phone
   numbers, no plates yet [F-F1].
5. Taps **Request seat** on the 8:00 car, and ticks **Any car that fits is fine** [F-D1, F-C4].
6. Gets one of:
   - **Requested**: before the allocation time (10 PM by default), seats aren't given out yet.
     At 10 PM they go to the most reliable riders [F-D2];
   - **Confirmed**: after 10 PM, a seat was still free [F-D3];
   - **Waitlisted #2** — the car is full or still allocating; they keep their place in line
     [F-D4];
   - **Placed in another car** — the 8:00 was full, but the 8:15 had room [F-D6].
7. Once confirmed: sees the car's photos, colour and plate, the owner's number, a WhatsApp
   button, and **Pay ₹150 by UPI** for after the ride [F-D8].
8. Gets a reminder 15 minutes before pickup [F-E3].

Target: steps 3 to 6 take under a minute.

## 2. A car owner sets up once

1. Signs in with Google, adds name and phone [F-A1, F-A2].
2. Adds the car **once**: photos, model, colour, number plate, seats; UPI ID optional
   [F-A3, F-A5].
3. Saves the **usual ride** once: stops in order (*Palwal bus stand → stops on the way →
   Shankar Chowk*), departure 8:00, 3 seats, ₹150 per seat, "AC, no smoking" [F-B1].

Five minutes, one time. Never again.

## 3. The evening tap

1. At 9 PM the owner opens the app. One screen: **Go live for tomorrow — 8:00, 3 seats, ₹150?**
2. Taps **Go live** [F-B2]. (Tomorrow they have a meeting, so they change 8:00 to 7:30 first.
   Owners who drive every weekday switch on automatic go-live and skip even this [F-B3].)
3. Optionally taps **Share to WhatsApp**, and the group sees a preview card:
   *Palwal → Shankar Chowk · 8:00 · 3 seats · ₹150* [F-H1].
4. From here the app does the work: it collects requests, allocates the seats, and keeps the
   count live. The owner just gets updates: *"Your car is full for tomorrow"* [F-E2].
5. Next morning the owner taps **Start ride**, marks each rider picked up (or no-show), and
   **Complete** at the office [F-B8].

## 4. More requests than seats: who gets them

The 8:00 car has 3 seats. By 10 PM, five commuters have requested.

1. Until 10 PM, requests only queue. Nobody is confirmed yet, so a rider who is quick on the
   phone but unreliable can't jump the line [F-D2].
2. At 10 PM, allocation ranks the requests by **reliability score**, which is built from
   rides completed, no-shows and late cancellations [F-D2, F-F3]. The three most reliable get the
   seats; the other two are waitlisted in score order [F-D4].
3. The two waitlisted riders ticked "any car is fine", so the app looks for other matching cars
   with free seats and offers those [F-D6].
4. Everyone is notified of where they stand [F-E1]. Nobody messages anybody.

*(This is option A of [Q4](decisions.md#q4-how-allocation-works), the proposed default.
Requests after 10 PM confirm instantly while seats remain.)*

## 5. A confirmed rider cancels at 7 AM

1. The rider cancels their seat [F-D7]. It's an hour before pickup, so it counts as a late
   cancellation on their record [F-F3].
2. The seat goes back into the pool in the same instant, and the first person on the waitlist is
   confirmed automatically and notified [F-D4, F-D5].
3. If the waitlist is empty, the ride card in search shows one seat free again, and anyone with a
   matching ride alert is pinged [F-E4].

The owner did nothing, and the car still leaves full.

## 6. A rider doesn't turn up

1. At pickup the owner waits, then marks the booking **No-show** and drives on [F-B8, F-F2].
2. The rider's score drops; for the next 90 days they rank lower when seats are scarce [F-F3].
   Their own profile shows exactly why [F-F4].
3. If the mark is wrong ("the car never came"), the rider disputes it and the admin decides
   [F-F5, v1.1]. Owners who mark unusually many no-shows get flagged to the admin [F-G5, v1.1].

## 7. The owner cancels

1. The owner cancels tomorrow's ride, giving a reason [F-B4].
2. Every confirmed and waitlisted rider is notified instantly, and the app tries to re-place each
   of them in other matching cars [F-D6, F-E1].
3. Repeated late cancels show on the owner's record too [F-F6, v1.1].

## 8. The admin's week

1. Opens the dashboard: rider rankings — scores, no-shows, late cancels [F-G1].
2. Checks occupancy: *"Mon–Fri we offered 240 seats, filled 231"* [F-G2]; and unmet demand:
   *"Tuesday 8–9 AM had 11 riders and no seats"* — time to recruit another car owner [F-G3,
   v1.1].
3. Reviews reports and no-show disputes; removes one spammer [F-G4].

## 9. Two people, one seat, same second

1. Riders A and B tap **Request** on the last seat at the same moment.
2. The database only ever lets one booking take the last seat — whoever's transaction lands
   first [F-D5]. The other is waitlisted automatically [F-D4], and offered other cars [F-D6].
3. Nobody sees a wrong seat count, ever.
