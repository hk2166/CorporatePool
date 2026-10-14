-- Rides (T-1.2, part 3 of 5): usual_rides, rides, ride_stops.
-- Design: docs/lld.md "Data model" and "Status flows", docs/db-diagram.md.
-- RLS is on with no policies, as in part 2; T-1.3 adds the access rules.

-- A ride may only use a car its owner owns. The pair (id, owner_id) is already unique because
-- id is, but a foreign key needs a declared unique constraint to point at.
alter table public.cars add constraint cars_id_owner_id_key unique (id, owner_id);

-- ---------------------------------------------------------------------------------------------
-- usual_rides: the template the owner saves once (F-B1). "Go live" copies it into a ride for
-- one day (F-B2, D7); auto go-live does the same on chosen weekdays (F-B3).

create table public.usual_rides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  car_id uuid not null,
  -- Wall-clock departure time in India (IST).
  depart_time time not null,
  seats_offered smallint not null check (seats_offered between 1 and 7),
  -- Whole rupees per seat. The owner sets it; there's no cap (Q5).
  price_per_seat integer not null check (price_per_seat >= 0),
  notes text check (char_length(notes) <= 280),
  -- Weekdays to go live automatically, as a bitmask: Mon = 1, Tue = 2, Wed = 4 … Sun = 64.
  -- 0 means the owner taps Go live by hand.
  auto_golive_days smallint not null default 0 check (auto_golive_days between 0 and 127),
  -- Ordered stops, copied into ride_stops at go-live: [{place_id?, label, lat, lng,
  -- eta_offset_min}]. At least a start and an end.
  stops jsonb not null
    check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) between 2 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (car_id, owner_id) references public.cars (id, owner_id) on delete cascade
);

create index usual_rides_owner_id_idx on public.usual_rides (owner_id);
-- Finds the templates the auto go-live job has to run for.
create index usual_rides_auto_golive_idx on public.usual_rides (auto_golive_days)
  where auto_golive_days > 0;

alter table public.usual_rides enable row level security;

-- ---------------------------------------------------------------------------------------------
-- rides: one actual trip on one day.
--
-- Rides are history: riders' bookings and reliability scores point at them. The owner and car
-- references are ON DELETE RESTRICT, so an owner with past rides can't be deleted outright
-- (T-2.4 anonymises instead).

create type public.ride_status as enum
  ('OPEN', 'ALLOCATING', 'FULL', 'STARTED', 'COMPLETED', 'CANCELLED');

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete restrict,
  car_id uuid not null,
  -- Set when the ride came from a usual ride; cleared if that template is deleted.
  usual_ride_id uuid references public.usual_rides (id) on delete set null,
  depart_at timestamptz not null,
  -- When ranked allocation runs (Q4). Defaults to 22:00 IST the evening before (Q6); the app
  -- sets it at go-live.
  allocation_at timestamptz not null,
  seats_total smallint not null check (seats_total between 1 and 7),
  -- Changed only by AllocationService's conditional UPDATE (lld.md §2).
  seats_left smallint not null,
  price_per_seat integer not null check (price_per_seat >= 0),
  notes text check (char_length(notes) <= 280),
  women_only boolean not null default false,
  status public.ride_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  foreign key (car_id, owner_id) references public.cars (id, owner_id) on delete restrict,
  check (seats_left between 0 and seats_total),
  check (allocation_at <= depart_at),
  -- Seat count and status must agree. The allocation code flips them together (lld.md §2), so
  -- a bug there fails loudly instead of showing a full car as open, or the reverse.
  check (status <> 'FULL' or seats_left = 0),
  check (status <> 'OPEN' or seats_left > 0),
  -- Auto go-live can run twice and still create one ride per day (D7). One-off rides have no
  -- usual_ride_id, and NULLs never clash, so they're unaffected.
  unique (usual_ride_id, depart_at)
);

-- Search only looks at rides that still take requests (lld.md §1).
create index rides_searchable_depart_at_idx on public.rides (depart_at)
  where status in ('OPEN', 'ALLOCATING');
-- The allocation job picks up rides whose window has closed (lld.md §4).
create index rides_allocation_at_idx on public.rides (allocation_at) where status = 'OPEN';
create index rides_owner_id_idx on public.rides (owner_id);
create index rides_car_id_idx on public.rides (car_id);

alter table public.rides enable row level security;

-- ---------------------------------------------------------------------------------------------
-- ride_stops: a ride's route as ordered stops. Search matches a stop near the rider's pickup
-- and a later stop (higher seq) near their drop (lld.md §1).

create table public.ride_stops (
  ride_id uuid not null references public.rides (id) on delete cascade,
  seq smallint not null check (seq between 0 and 11),
  -- Set when the stop came from the landmark list; a dropped pin has only geo.
  place_id uuid references public.places (id) on delete set null,
  geo extensions.geography(point, 4326) not null,
  label text not null check (label = btrim(label) and char_length(label) between 2 and 80),
  -- Minutes after depart_at that the car reaches this stop. The first stop is the departure.
  eta_offset_min smallint not null default 0 check (eta_offset_min between 0 and 600),
  primary key (ride_id, seq),
  check (seq > 0 or eta_offset_min = 0)
);

create index ride_stops_geo_idx on public.ride_stops using gist (geo);

alter table public.ride_stops enable row level security;
