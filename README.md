# CorporatePool

A free app for sharing the daily office commute, starting with rides from Palwal to Gurgaon
(Shankar Chowk). It replaces the WhatsApp groups where car owners post *"leaving 8:00 from Palwal
to Shankar Chowk, 3 seats, ₹150"* and commuters reply to grab a seat. (CorporatePool is a working
name.)

> **Status: idea and design discussion.** There is no code yet. These docs are where we agree on
> what to build before we build it.

## How it works, in short

- **Commuter:** signs up once, searches *"Palwal → Shankar Chowk, tomorrow, 8–9 AM"*, sees the
  cars that fit, and requests a seat.
- **Car owner:** adds their car once (photos, number plate, colour) along with their usual route.
  The evening before, they tap **Go live** and the ride is visible to everyone.
- **The app:** keeps seat counts up to date, gives seats first to riders who rarely miss a ride,
  and moves waiting riders into empty seats so no car leaves half-empty.
- **Admin:** sees rider rankings, how full the cars are, and reports, and can remove bad actors.

## Read in this order

| Doc | What's in it |
|---|---|
| [idea.md](idea.md) | The problem, who it's for, how it works, principles, what success looks like |
| [docs/features.md](docs/features.md) | Every proposed feature with an ID and a priority. **The main doc to discuss.** |
| [docs/user-flows.md](docs/user-flows.md) | Step by step: signing up, searching, going live, how seats get allocated, cancellations, the admin's view |
| [docs/decisions.md](docs/decisions.md) | What's agreed, what's still open, and the proposed defaults |
| [docs/hld.md](docs/hld.md) | High-level design: architecture, free-tier stack, scheduled jobs |
| [docs/lld.md](docs/lld.md) | Low-level design: data model, booking statuses, search, seat allocation, reliability score, API |
| [docs/db-diagram.md](docs/db-diagram.md) | The whole data model as one class diagram |
| [docs/setup.md](docs/setup.md) | One-time setup: accounts, keys, local tools, first admin |
| [docs/deploy.md](docs/deploy.md) | Going live: database, Vercel, connecting them, the phone check |

## How we discuss

- Every feature has an ID like `F-B2`, and every open question an ID like `Q4`. Refer to them by
  ID: "F-B2 should be v1", "Q6: cutoff at 10 PM".
- A feature is **Proposed** until we agree on it. Then it becomes **Agreed** or **Dropped** in
  features.md, and the reason goes into decisions.md.
- Features come first. When a feature changes, we update the HLD and LLD after it.

## Ground rules

1. **Free forever, for users and for us.** Free tiers only. No commission, no ads, no paid APIs.
2. **Less effort than WhatsApp.** Going live is one tap. Finding a seat takes under a minute.
3. **Reliable riders first.** Seats go first to riders with the fewest no-shows, and no car should
   leave with empty seats when someone is waiting.
4. **Private by default.** Phone numbers and number plates are shown only to people in a confirmed
   booking.
5. **The app never touches money.** Riders pay the car owner directly, by UPI or cash.

## Progress

| Stage | State |
|---|---|
| Idea and features | In discussion |
| HLD / LLD | First draft, waiting on the open questions |
| Code | Not started |
