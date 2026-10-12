# Decisions

Two lists: what's **decided** (with the reason), and what's **open** (with a proposed default).
When an open question is answered, it moves to the decided list and the affected docs get
updated.

## Decided

| ID | Decision | Why |
|---|---|---|
| D1 | Free forever: free tiers only, no commission, no ads, no paid APIs | The whole point. Also keeps us out of the money flow legally. |
| D2 | Installable web app (PWA), not native apps | App stores cost money (Google $25 once, Apple $99/year); a PWA is free, installs to the home screen and can send push notifications. |
| D3 | No payments through the app; UPI deep link + cash instead | No gateway fees, no KYC, keeps it clearly cost-sharing. |
| D4 | No in-app chat; WhatsApp button after confirmation | Everyone is already on WhatsApp. |
| D5 | Work **with** WhatsApp: every ride has a shareable link with a preview card | An empty app can't compete with a 1,000-person group; the groups become the app's front door. |
| D6 | Commuter experience is **search-first**, like a cab app: *from → to → when*, then only cars that fit | Hemant, 2026-10-12: commuters "just search for the cab… the app should filter the cabs as per the need". |
| D7 | Car owner sets up car + usual ride **once**; each day is one **Go live** tap | Hemant, 2026-10-12: owners "one time upload their car details… at the evening they just have to click to post their car live". |
| D8 | The app manages seats **automatically**: live counts, waitlist, auto-promotion, cross-car matching | Hemant, 2026-10-12: "the app should manage automatically how many seats are still left… so no cab should go empty". |
| D9 | Automatic rider ranking by **reliability** (no-shows, late cancels, completed rides); when seats are scarce, reliable riders win | Hemant, 2026-10-12: "rank the users… give the users with least no-shows the most seats". |
| D10 | Score rules are public in-app; everyone can see their own score and history; misses stop counting after 90 days | A hidden ranking that costs people seats would feel rigged and kill trust. |
| D11 | Rides are ordered lists of landmark stops, not drawn road routes | Needs no routing API (free), and matches how commuters already talk ("via <landmark>"). Route-line matching can come later. |
| D12 | Phone numbers, car photos and plates visible only after a confirmed booking | Privacy by default. |

## Open questions

### Q1. Who are the drivers?
Own-car office commuters, cab drivers running the same shared trip daily, or both?
- **Changes:** pricing rules (cost-sharing vs fare), trust checks (work badge vs permit),
  and the legal picture (white plate vs yellow plate).
- **Proposed default:** design for both, add a "driver type" field (F-A8), launch with whoever
  today's group actually is. **Hemant: what's the mix in your group?**

### Q2. Which area?
Just the Palwal → Gurgaon corridor, the NCR, or any city from day one?
- **Changes:** whether we can hand-pick ~100 landmarks (great search, zero cost) or need a
  general place-search service.
- **Proposed default:** one corridor at launch with a hand-picked landmark list (F-G6), built so
  adding a new corridor is just adding rows, not code.

### Q3. Who can join?
Anyone with a Google account, or invite-only / approved by an admin, like today's groups?
- **Changes:** whether "communities" (F-F11) exist in the data model from day one, and how safe
  the rides feel.
- **Proposed default:** invite-link only at launch (the group admin posts the link), open
  signup later. Cheap to build, mirrors how the groups work now.

### Q4. How allocation works
Decided ([D9]) that reliable riders win when seats are scarce. Still open: **when** does ranking
apply?
- **Option A — allocation window:** a ride collects requests for its first N hours (say, until
  2 hours after going live, or until a fixed time like 10 PM); then seats are allocated by
  score; after that, leftover seats are instant, first-come. Fairest to reliable riders who
  don't live on their phone, but a rider doesn't know instantly.
- **Option B — instant always:** first-come-first-served while seats last; the score only orders
  the waitlist and breaks same-moment ties. Simplest and instant, but a flaky rider who's quick
  on the phone still beats a reliable one.
- Also open: does the owner get any say — none at all, a veto to remove a specific rider
  (F-D10), or full manual approve?
- **Proposed default:** Option A with a window ending at a fixed cutoff the evening before
  (e.g. 10 PM), plus owner veto in v1.1. Matches the "post in the evening, sorted by morning"
  rhythm the groups already have.

### Q5. Pricing
Does the owner set any price, or does the app cap it near fuel-cost-per-seat?
- **Changes:** legal position (a cap keeps it clearly cost-sharing) and whether cab operators
  (Q1) can use it at all.
- **Proposed default:** owner sets the price; the app shows a suggested cost-share figure
  (F-B6) and flags prices far above it. Revisit after Q1.

### Q6. Go-live and allocation times
What's the rhythm? E.g. owners can go live any time; most do at ~9 PM; allocation at 10 PM;
requests after 10 PM take leftover seats instantly; everything closes at departure.
- **Proposed default:** exactly that, with the times configurable per route. Depends on Q4
  choosing Option A.

### Q7. Stack
TypeScript end-to-end (Next.js + Supabase) is assumed in [hld.md](hld.md) because it fits the
free tiers with nothing to keep running. Python (FastAPI) or Go are fine languages but need an
always-on server, which free hosting does badly (sleep + cold starts at 8 AM).
- **Proposed default:** Next.js + Supabase. **Hemant: any preference?**

### Q8. What's the goal?
Ship something the group really uses, or also practice HLD/LLD for interviews?
- **Changes:** how deep the LLD goes (class diagrams, design patterns, capacity maths) and
  whether we optimise for shipping speed.
- **Proposed default:** ship first; keep the LLD honest but practical.
