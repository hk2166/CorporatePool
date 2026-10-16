-- Bookings and scoring (T-1.2, part 4 of 5): bookings, reliability_events, reviews.
-- Design: docs/lld.md "Data model", "Status flows" and §3–§5, docs/db-diagram.md.
-- RLS is on with no policies, as in parts 2–3; T-1.3 adds the access rules.

-- ---------------------------------------------------------------------------------------------
-- bookings: a rider's request for seats on one ride, and everything that happens to it.

create type public.booking_status as enum (
  'REQUESTED', 'CONFIRMED', 'WAITLISTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'COMPLETED',
  'NO_SHOW'
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- Bookings are history (scores are built from them), so neither the ride nor the rider can
  -- be deleted while bookings point at them.
  ride_id uuid not null references public.rides (id) on delete restrict,
  rider_id uuid not null references public.users (id) on delete restrict,
  pickup_seq smallint not null,
  drop_seq smallint not null,
  seats smallint not null default 1 check (seats between 1 and 7),
  -- "Any car that fits is fine": lets cross-car matching move the rider (F-C4, F-D6).
  any_car_ok boolean not null default false,
  status public.booking_status not null default 'REQUESTED',
  -- Position on the waitlist; the allocation job fills it in score order (lld.md §4).
  waitlist_rank integer check (waitlist_rank >= 1),
  created_at timestamptz not null default now(),
  -- When the request got an outcome (confirmed, waitlisted, cancelled …).
  decided_at timestamptz,
  -- Pickup and drop must be stops of this very ride, and you can't ride backwards.
  foreign key (ride_id, pickup_seq) references public.ride_stops (ride_id, seq),
  foreign key (ride_id, drop_seq) references public.ride_stops (ride_id, seq),
  check (pickup_seq < drop_seq),
  -- A waitlist position exists exactly while the booking is waitlisted.
  check ((status = 'WAITLISTED') = (waitlist_rank is not null)),
  -- Only a request still waiting for its outcome has no decided_at.
  check ((status = 'REQUESTED') = (decided_at is null))
);

-- One active booking per rider per ride. Once it's cancelled, declined or finished, the rider
-- may request again.
create unique index bookings_one_active_per_rider_idx on public.bookings (ride_id, rider_id)
  where status in ('REQUESTED', 'CONFIRMED', 'WAITLISTED');
-- Allocation and promotion read a ride's bookings by status, and the waitlist in order.
create index bookings_ride_id_status_idx on public.bookings (ride_id, status);
create index bookings_waitlist_idx on public.bookings (ride_id, waitlist_rank)
  where status = 'WAITLISTED';
-- "My bookings", newest first.
create index bookings_rider_id_created_at_idx on public.bookings (rider_id, created_at desc);

alter table public.bookings enable row level security;

-- ---------------------------------------------------------------------------------------------
-- reliability_events: the score's audit trail (lld.md §3, F-F3–F-F5). The cached numbers on
-- users are recomputed from these; a rider can see exactly which events made their score.

create type public.reliability_event_kind as enum
  ('COMPLETED', 'NO_SHOW', 'LATE_CANCEL', 'OWNER_LATE_CANCEL');

create table public.reliability_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  kind public.reliability_event_kind not null,
  -- A rider's event comes from one booking. An owner's late cancel is about the whole ride, so
  -- it points at the ride and counts once, however many riders it affected.
  booking_id uuid references public.bookings (id) on delete restrict,
  ride_id uuid references public.rides (id) on delete restrict,
  -- Positive for a completed ride, negative for a miss. The amounts live in the score code
  -- (lld.md §3: +2, −15, −5) so they can be tuned without a migration.
  points smallint not null check (points between -100 and 100),
  created_at timestamptz not null default now(),
  -- The rider disputes the event (F-F5); an admin resolves it.
  disputed boolean not null default false,
  resolved_by uuid references public.users (id) on delete set null,
  check (
    (kind = 'OWNER_LATE_CANCEL' and ride_id is not null and booking_id is null)
    or (kind <> 'OWNER_LATE_CANCEL' and booking_id is not null and ride_id is null)
  ),
  check ((kind = 'COMPLETED') = (points > 0)),
  check (resolved_by is null or disputed)
);

-- A booking ends one way (completed, no-show or late cancel), so it produces at most one
-- event; an owner's late cancel counts once per ride. This also makes the jobs that write
-- events safe to re-run.
create unique index reliability_events_one_per_booking_idx on public.reliability_events (booking_id)
  where booking_id is not null;
create unique index reliability_events_one_per_ride_idx on public.reliability_events (ride_id)
  where ride_id is not null;
-- The score uses each person's last 90 days of events.
create index reliability_events_user_id_created_at_idx
  on public.reliability_events (user_id, created_at desc);

alter table public.reliability_events enable row level security;

-- ---------------------------------------------------------------------------------------------
-- reviews: 1–5 stars after a ride, each way (F-F7, v1.1).

create table public.reviews (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_user uuid not null references public.users (id) on delete cascade,
  to_user uuid not null references public.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  -- Each side reviews a booking once.
  primary key (booking_id, from_user),
  check (from_user <> to_user)
);

create index reviews_to_user_idx on public.reviews (to_user);

alter table public.reviews enable row level security;
