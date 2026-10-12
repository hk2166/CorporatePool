# The idea

## The problem

Every weekday, lots of people get from towns like Palwal to offices in Gurgaon in shared cars
that they find through WhatsApp groups. It works like this:

1. A car owner posts a message with the starting point, the route, departure time, free seats and
   price per seat.
   > *"Leaving 8:00 AM from Palwal to Shankar Chowk. 3 seats, ₹150/seat."*
2. Commuters reply in the group or message the owner to grab a seat.
3. They agree on a pickup point over chat or a call.
4. The commuter pays at the end, in cash or by UPI.

This works because everyone is already on WhatsApp. But a group chat is a poor tool for the job:

| Problem | What it looks like today |
|---|---|
| Rides get buried | By evening there are dozens of messages. Finding one that suits you means scrolling and reading every post. |
| No search | You can't ask "which cars go from Palwal to Shankar Chowk between 8 and 9?" You read each post and work it out yourself. |
| Seat counts are guesswork | Owners don't update posts when seats fill. Commuters ask "seat still free?", and cars get overbooked or leave half-empty. |
| No-shows cost everyone | Someone books a seat, doesn't turn up, and the car leaves with an empty seat that another commuter wanted. Nothing happens to the person who didn't show. |
| Same post every day | An owner who leaves at 8:00 every weekday types the same message every day. |
| Little trust | You know a name and a number. There's no history and no way to tell who is reliable. |
| No privacy | Your phone number is visible to everyone in a group of up to 1,024 people. |

## Who it's for

| Person | What they want |
|---|---|
| **Commuter**: needs a seat to Gurgaon | Search a route, see only the cars that fit, get a confirmed seat, know who they're riding with |
| **Car owner**: drives to Gurgaon with free seats | Set up the car once, go live with one tap, have every seat filled by people who actually turn up |
| **Admin**: runs the community, like a WhatsApp group admin today | See who is reliable and who isn't, see how full the cars are, remove bad actors |

One account can be both. Someone can commute as a rider on Monday and offer their car on Tuesday.

> **Open question [Q1](docs/decisions.md#q1-who-are-the-drivers):** are the cars in today's groups
> mostly people driving to their own office (carpooling), or cab drivers running shared trips
> every day (shared taxi)? Or both? The answer changes pricing, trust checks and the legal picture.

## How it works

### Commuter

1. Signs up once: Google sign-in, name, phone number, and their usual pickup and office stops.
2. Searches like booking a cab: **Palwal → Shankar Chowk, tomorrow, 8–9 AM**.
3. The app shows only the cars that fit: the route passes near their pickup, it reaches their
   stop, the time fits, and seats are left. Results are sorted by best fit.
4. Requests a seat on a car, and can tick **Any car that fits is fine**.
5. Gets a notification when the seat is confirmed, or is put on a waitlist and moved into another
   car if one has room.

### Car owner

1. **Once:** adds the car (photos, model, colour, number plate, seats) and their usual ride
   (stops, time, price per seat).
2. **The evening before:** taps **Go live for tomorrow**. The usual ride goes up as it is, or they
   change the time or seats first. Owners who drive every weekday can switch on automatic go-live.
3. That's it. The app collects requests, gives out the seats, keeps the seat count up to date, and
   tells the owner who is coming.

### The app, behind the scenes

- **Seat counts look after themselves.** Every booking and cancellation updates the count at once,
  and two people can never get the same seat.
- **Reliable riders get seats first.** Every commuter has a reliability score built from rides
  completed, no-shows and last-minute cancellations. When a car gets more requests than seats, the
  highest scores win.
- **No car leaves empty if someone is waiting.** Riders who miss out are offered seats in other cars
  on the same route. When a confirmed rider cancels, the next person on the waitlist moves up
  automatically.

### Admin

- Sees every commuter's reliability score, no-shows and cancellations.
- Sees how full the cars are each day, and when commuters wanted seats but there were none.
- Handles reports and can remove a user or hide a ride.

## The idea in one paragraph

A free web app that installs on the phone like a normal app. Car owners set up their car and usual
route once, then go live with one tap the evening before. Commuters search a route like Palwal →
Shankar Chowk, see only the cars that fit, and request a seat. The app runs the seats: it gives
them first to the commuters who reliably turn up, keeps counts live, and moves waiting commuters
into empty seats so no car leaves half-empty. Once a seat is confirmed, both sides see each other's
number and a WhatsApp button, and the commuter pays the owner directly by UPI. Every ride has a
link that shows a preview card in WhatsApp, so the existing groups can still announce rides.

## Principles

1. **Free forever,** for users and for running it. Only free tiers, no commission, no ads. If
   something needs a paid service, we find another way or drop it.
2. **Less effort than WhatsApp.** Going live is one tap. Finding a seat takes under a minute.
3. **Reward reliability.** Turning up gets you seats. Not turning up costs you priority, but people
   can always earn it back.
4. **Fill every seat.** If a commuter is waiting and a car on their route has room, the app should
   connect them.
5. **Private by default.** Phone number and number plate are shown only to people in a confirmed
   booking.
6. **No money through the app.** A UPI payment link, or cash. No payment gateway, no KYC, no fees.
7. **Simple to run.** One person can run it in their spare time, with no servers to look after.

## What success looks like

For the Palwal → Gurgaon route, one month after launch:

- Most cars that used to post in the WhatsApp groups go live in the app instead.
- A commuter can find and request a suitable seat in under a minute.
- Cars leave fuller than before; we track seats filled out of seats offered every day.
- No-shows go down, because they now cost something.
- There are no double bookings, and running cost is still ₹0.

## Not doing (for now)

| Not doing | Why |
|---|---|
| Payments inside the app | Needs a payment gateway, KYC and fees, and puts the app in the money flow, which adds legal risk. We show a UPI link instead. |
| Chat inside the app | Everyone already uses WhatsApp. After a booking is confirmed we show a WhatsApp button. |
| Live GPS tracking | Costly to build and heavy on battery. A "share trip" link and WhatsApp live location cover most of it. |
| Native Android/iOS apps | App stores charge fees (Google $25 once, Apple $99 a year). An installable web app (PWA) is free. |
| Commission, ads, surge pricing | The app is free. |

## Risks

| Risk | Why it matters | What we do about it |
|---|---|---|
| Nobody uses it at first | With no cars, commuters don't come; with no commuters, owners don't go live | Ride links that work inside the existing WhatsApp groups; launch on one route first |
| Ranking feels unfair | People who lose seats to higher scores may feel punished | Clear rules shown in the app; new users start with a fair score; old misses stop counting after 90 days |
| Owners mark no-shows unfairly | An owner could hurt someone's score on purpose | Riders can dispute a no-show; the admin sees owners who mark unusually many |
| Legal | In India, carrying paying passengers in a private (white-plate) car is a grey area, and rules differ by state | Keep it clearly cost-sharing and never handle money. Check the Haryana rules before a public launch (this is not legal advice). Depends on Q1. |
| Safety | Strangers share a car | Car photos and plate, profiles with history, numbers hidden until booking, report and block, share-trip link, women-only rides |
| Free tiers change | Providers change limits without notice | Keep the stack portable: plain Postgres and a standard web app |
