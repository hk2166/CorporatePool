# task.md — build plan for agents

You are an agent building **CorporatePool**, a free carpooling PWA for daily office commutes
(first route: Palwal → Gurgaon). This file is the work queue. Pick the next unclaimed task in
order, build it, verify it, and stop.

Claim a task by changing `[ ]` to `[~]` and adding your branch name after it. Change it to `[x]`
in the same PR that finishes the task. See "Order and parallelism" for what can run at once.

## Read first, always

1. [README.md](README.md) — ground rules (free forever, no payments in-app, privacy by default)
2. [idea.md](idea.md) — what the app is and for whom
3. [docs/features.md](docs/features.md) — feature IDs (`F-xx`) used below; build **v1 only**
4. [docs/user-flows.md](docs/user-flows.md) — what "working" looks like, flow by flow
5. [docs/decisions.md](docs/decisions.md) — D1–D12 are law; Q1–Q8 resolved for building below
6. [docs/hld.md](docs/hld.md) — architecture and free-tier stack
7. [docs/lld.md](docs/lld.md) + [docs/db-diagram.md](docs/db-diagram.md) — schema, SQL, algorithms

## Rules for every agent

- **Stack (fixed):** Next.js (current stable, App Router, TypeScript strict) on Vercel ·
  Supabase (Postgres + PostGIS, Auth, Storage, Realtime, pg_cron) · Tailwind CSS · MapLibre +
  OpenFreeMap · Web Push (VAPID). No other services. Nothing that costs money (D1).
- **Never** add: payment processing, in-app chat, GPS tracking, SMS, Firebase, paid APIs.
- Don't change a D-decision or resolve a Q-question differently; if a task seems to need it,
  stop and report instead.
- Every change to seat counts goes through `AllocationService` and the conditional UPDATE
  (lld §2). No other code may touch `rides.seats_left`.
- Reference feature IDs in commit messages: `feat(F-C1): search api`.
- One task = one branch = one PR. Keep PRs reviewable (< ~500 lines where possible).
- Each task's **Done when** list is the acceptance test. Add unit tests for anything in
  lld §§2–5 (seats, score, allocation, promotion) — that logic is the product.
- Secrets only in `.env.local` / Vercel env vars. Commit an updated `.env.example` instead.
- Local dev runs against the Supabase CLI (`supabase start`, Dockerised Postgres with PostGIS);
  migrations live in `supabase/migrations/`.

## Working decisions (open questions pinned for the build)

These adopt the proposed defaults from [decisions.md](docs/decisions.md). Flag, don't fight.

| Q | Pinned as |
|---|---|
| Q1 driver type | Build for both; `users` gets no permit fields in v1 |
| Q2 area | One corridor; landmarks are seeded rows (T-1.4, list from Hemant in H-5), no external place API in v1 (Photon fallback is v1.1) |
| Q3 who joins | Invite-link signup; a `signup_tokens` table, admin generates links |
| Q4 allocation | Option A, strictly. Before `allocation_at`, every request stays REQUESTED, with no instant confirms even if seats are free. At `allocation_at`, rank by score, then confirm or waitlist. After it, a request confirms instantly while seats remain, otherwise it's waitlisted. A ride that goes live after its `allocation_at` is instant from the start. No owner approval in v1 (veto is v1.1) |
| Q5 pricing | Owner sets price; app shows a suggested cost-share figure, no cap |
| Q6 times | Default `allocation_at` = 22:00 IST the evening before, configurable per ride |
| Q7 stack | As fixed above |
| Q8 goal | Ship; practical code over pattern showcases |

## Repo layout (target)

```
app/            Next.js routes: (auth)/ (rider)/ (owner)/ (admin)/ r/[code]/ api/
lib/            services: search.ts allocation.ts reliability.ts rides.ts notify.ts db.ts
components/
supabase/       migrations/ seed/ functions/ (edge fns) config.toml
tests/          unit/ e2e/
public/         manifest, icons
```

---

## Order and parallelism

Phases run in order (1 → 8). Exceptions:
- Phase 1: T-1.1 first, then T-1.2. After T-1.2, T-1.3 and T-1.4 can run in parallel.
- Phase 4 (search) can start as soon as T-3.2 has merged.
- T-6.3 (push sender) can be built alongside Phase 5. Services write outbox rows from day one.
- **Never run two agents on Phase 5 at the same time.** All of it touches the seat logic.

## Phase 0 — human setup (Hemant, not agents)

- [ ] **H-1** Create a Supabase project (free tier) and a Vercel project linked to this repo
- [ ] **H-2** Google OAuth client; put the credentials in Supabase Auth → Google
- [ ] **H-3** Generate VAPID keys (`npx web-push generate-vapid-keys`); add all keys/URLs to
      Vercel env + `.env.local` (agents list the exact names in `.env.example` as they go)
- [ ] **H-4** Install Docker + Supabase CLI locally so `supabase start` works for agents
- [ ] **H-5** Write the corridor landmark list: about 30 real stops on the Palwal → Gurgaon
      route(s), each with name, lat and lng, saved as `supabase/seed/landmarks.csv`. Agents must
      not guess stops or coordinates.

## Phase 1 — foundation

- [ ] **T-1.1 Scaffold.** Next.js 15 + TS strict + Tailwind + ESLint/Prettier; `supabase init`;
      GitHub Actions CI: typecheck, lint, unit tests on PR. *Done when:* CI is green on a PR
      that touches a sample component and a sample test.
- [ ] **T-1.2 Schema migration.** Entire data model from lld "Data model" + db-diagram.md as SQL
      migrations: every table in db-diagram.md (15, including `signup_tokens`, `blocks` and
      `admin_actions`), enums, the constraints in db-diagram's "what the picture can't
      show" table (unique indexes, `pickup_seq < drop_seq` check, GiST indexes), PostGIS enabled.
      *Done when:* `supabase db reset` applies cleanly; a migration test inserts/violates each
      constraint.
- [ ] **T-1.3 RLS policies (D12).** Phone/plate/photos readable only within a confirmed booking
      on that ride; scores readable by owner + admin; public ride link exposes only route, time,
      price, seats left, owner first name. *Done when:* pgTAP (or SQL test script) proves each
      policy with two test users.
- [ ] **T-1.4 Seed.** `supabase/seed/`: landmarks loaded from H-5's CSV. Until that file
      exists, use a two-stop placeholder (Palwal and Shankar Chowk, approximate coordinates,
      marked `-- placeholder`). Also seed 3 demo users, 1 car, 1 usual ride and 1 live ride. *Done when:*
      fresh reset + seed lets you run the search SQL from lld §1 by hand and get the demo ride.

## Phase 2 — accounts (F-A1…A6, A9)

- [ ] **T-2.1 Auth.** Google sign-in via Supabase Auth; invite-token gate (Q3): signup requires a
      valid `signup_tokens` row; session middleware. *Done when:* new Google user with token →
      profile row created; without token → friendly rejection.
- [ ] **T-2.2 Profile + usual stops.** Name/photo/phone form; pick home & office from landmark
      list (F-A6). *Done when:* flow 1 steps 1–2 of user-flows.md work on mobile viewport.
- [ ] **T-2.3 Car setup (F-A3).** Photos → Supabase Storage, resized client-side to ≤ 200 KB;
      model/colour/plate/seats. One-time; editable. *Done when:* flow 2 steps 1–2 work; photos
      load via RLS-safe signed URLs only for permitted viewers.
- [ ] **T-2.4 Account deletion (F-A9).** Hard-delete personal fields, anonymise history rows.
      *Done when:* deleted user's bookings remain as "deleted user", no PII left in any table.

## Phase 3 — rides (F-B1…B4, F-H1)

- [ ] **T-3.1 Usual ride editor (F-B1).** Stops (ordered, from landmarks or map pin), time,
      seats, price, notes; suggested cost-share figure shown (Q5). *Done when:* flow 2 step 3
      works; stops persist as jsonb per schema.
- [ ] **T-3.2 Go live (F-B2).** One-tap screen with tweak-before-post; copies template →
      `rides` + `ride_stops` (lld "usual_rides vs rides"); sets `allocation_at` 22:00 (Q6).
      *Done when:* flow 3 steps 1–2 work; double-tap creates one ride (unique constraint).
- [ ] **T-3.3 Auto go-live (F-B3).** pg_cron evening job for `auto_golive_days`; skip-a-day UI.
      *Done when:* job is idempotent (run twice → one ride) and skip notifies allocated riders
      (outbox row; push comes in Phase 6).
- [ ] **T-3.4 Public ride page + OG card (F-H1).** `/r/[code]` with OG meta so WhatsApp previews
      *Palwal → Shankar Chowk · 8:00 · 2 seats · ₹150*; share button. *Done when:* page shows
      only public fields (T-1.3); OG tags verified in a card-preview test.
- [ ] **T-3.5 Edit / cancel ride (F-B4).** Cancel notifies + flags all bookings for re-match
      (consumed by T-5.4). *Done when:* flow 7 steps 1–2 state changes are correct in DB.

## Phase 4 — search (F-C1…C4)

- [ ] **T-4.1 Search API.** lld §1 SQL as an RPC/route: from, to, date, window → matching rides
      ranked by walk_m + time fit. *Done when:* unit tests cover: match, opposite-direction
      excluded (`d.seq > p.seq`), > 2 km excluded, full rides excluded.
- [ ] **T-4.2 Search UI (F-C1, F-C2).** From/to/when pickers defaulting to saved route ("my
      usual commute, tomorrow"); result cards per flow 1 step 4. *Done when:* flow 1 steps 3–4
      work on mobile.
- [ ] **T-4.3 Live seat counts (F-C3).** Supabase Realtime on `rides.seats_left` for visible
      cards + ride page. *Done when:* two browsers open; booking in one moves the count in the
      other without refresh.

## Phase 5 — booking & allocation (F-D1…D8) — **the core; test hardest**

- [ ] **T-5.1 Request + instant confirm (F-D1, F-D3).** A request has pickup, drop, seats and
      `any_car_ok`. Before `allocation_at` it stays REQUESTED. After it, confirm through the
      conditional UPDATE (lld §2) in one transaction, or set WAITLISTED if no seat is left
      (see the Q4 row above). *Done when:* a concurrency test sends two parallel post-window
      requests for the last seat and gets exactly one CONFIRMED, one WAITLISTED, and
      `seats_left = 0`, never negative. A pre-window request stays REQUESTED even with free
      seats.
- [ ] **T-5.2 Allocation job (F-D2, Q4).** pg_cron 5-min job: rides past `allocation_at` →
      rank REQUESTED by `(score DESC, created_at ASC)`, confirm top, waitlist rest (lld §4).
      *Done when:* fixture of 5 requests / 3 seats allocates exactly per lld §4; job idempotent.
- [ ] **T-5.3 Waitlist promotion (F-D4).** On cancel: seat back, FULL→OPEN, promote lowest rank
      in-request; 5-min sweep as safety net (lld §5). *Done when:* flow 5 passes end-to-end in a
      test; sweep catches an artificially missed promotion.
- [ ] **T-5.4 Cross-car matching (F-D6).** `rematch()` per lld §5 for `any_car_ok` waitlisted +
      cancelled-ride riders. *Done when:* flow 4 step 3 and flow 7 step 2 pass as tests.
- [ ] **T-5.5 Confirmed view (F-D8).** Contact + WhatsApp (`wa.me`) buttons, car photos/plate,
      UPI deep link `upi://pay?pa=…&am=…` with amount prefilled. *Done when:* flow 1 step 7
      works; fields invisible to non-parties (RLS test from T-1.3 extended).
- [ ] **T-5.6 Owner ride-day flow (F-B8).** Start → per-rider picked-up / no-show → complete;
      expiry job: auto-complete 3 h after departure, unmarked riders = COMPLETED (lld §8).
      *Done when:* flow 3 step 5 and both §8 failure cases pass as tests.

## Phase 6 — reliability & notifications (F-F*, F-E*)

- [ ] **T-6.1 Reliability events + score (F-F3).** Append events from T-5.6/T-5.3 outcomes;
      score formula + daily recompute with 90-day decay exactly per lld §3. *Done when:* unit
      tests: new user 50; +2/ride capped +40; −15 no-show; −5 late cancel; clamp 0–100; decay.
- [ ] **T-6.2 My reliability (F-F4, F-I2).** Score, event history with reasons, and a public
      "how the score works" page. *Done when:* a rider can trace every point change to an event.
- [ ] **T-6.3 Web push (F-E1, F-E2).** VAPID subscribe + outbox drainer (edge function via
      pg_net); events: confirmed, waitlisted, promoted, ride cancelled/edited, car full. *Done
      when:* outbox rows are written in the same transaction as the change (lld §6) and a crash
      between write and send loses nothing (retry test).
- [ ] **T-6.4 Reminders (F-E3).** 5-min pg_cron: pickup-in-15-min to riders + owner. *Done
      when:* idempotent — a rider never gets the same reminder twice.
- [ ] **T-6.5 Report & block (F-F8).** Report form → `reports`; blocked pairs never match in
      search/allocation. *Done when:* a blocked rider's request to that owner's ride is refused.

## Phase 7 — admin (F-G1, G2, G4, G6)

- [ ] **T-7.1 Rankings + occupancy.** Score table (sortable); seats offered vs filled per
      day/route. *Done when:* numbers reconcile with raw SQL on seeded fixtures.
- [ ] **T-7.2 Reports queue + actions.** Review reports, remove user, hide ride — all as
      audit-trail rows. *Done when:* removed user loses access; hidden ride vanishes from
      search but not from history.
- [ ] **T-7.3 Landmark manager + invite links (F-G6, Q3).** CRUD/merge landmarks; generate
      `signup_tokens`. *Done when:* merge re-points all references; invite flow from T-2.1
      works end-to-end.

## Phase 8 — PWA & launch

- [ ] **T-8.1 PWA (F-H2).** Manifest, icons, service worker, install prompt, iOS
      add-to-home-screen hint (push needs it). *Done when:* Lighthouse PWA pass; installed app
      receives a push on Android emulator + desktop.
- [ ] **T-8.2 Deploy.** Vercel prod + Supabase: all pg_cron schedules live (go-live, allocation,
      sweep, reminders, expiry, score, keep-warm per hld "Scheduled jobs"); `.env.example`
      complete. *Done when:* the production URL passes T-8.3.
- [ ] **T-8.3 E2E smoke (Playwright).** One scripted run of flows 1–5 + 9 of user-flows.md
      against a seeded instance. *Done when:* green in CI nightly.

---

## Definition of done (v1)

All v1-priority features in [features.md](docs/features.md) shipped; every "Done when" above
green; the nine user flows demonstrable on a phone from the production URL; monthly running
cost ₹0.

## Reporting format

End every task with: what shipped (files + feature IDs), how it was verified (test names /
manual steps), anything flagged (decision conflicts, free-tier surprises), and the next task
you'd pick.
