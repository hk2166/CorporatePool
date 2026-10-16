-- People and places (T-1.2, part 2 of 5): places, users, cars, signup_tokens, blocks.
-- Design: docs/lld.md "Data model" and docs/db-diagram.md.
--
-- Every table has Row-Level Security switched on and no policies yet, so nothing is readable
-- or writable through the public API until T-1.3 adds the access rules. Migrations and the
-- server's secret key bypass RLS.

-- ---------------------------------------------------------------------------------------------
-- places: the stops owners build routes from and riders search near (F-B1, F-A6).
-- Seeded from supabase/seed/landmarks.csv in T-1.4.

create type public.place_kind as enum ('landmark', 'metro', 'office', 'town');

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name = btrim(name) and char_length(name) between 2 and 80),
  geo extensions.geography(point, 4326) not null,
  kind public.place_kind not null default 'landmark',
  -- Popular stops are suggested first.
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now()
);

-- Proximity search ("a stop within 2 km of me") uses this.
create index places_geo_idx on public.places using gist (geo);

alter table public.places enable row level security;

-- ---------------------------------------------------------------------------------------------
-- users: one row per person, created at first sign-in (T-2.1). The id is the Supabase Auth id.
--
-- Deleting the auth user deletes this row too, but only while the person has no ride history:
-- rides, bookings and reliability events reference users with ON DELETE RESTRICT (parts 3–4).
-- Account deletion (T-2.4) therefore anonymises the row instead of deleting it.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 80),
  photo_url text check (photo_url ~ '^https?://'),
  -- Required before booking or offering a ride (F-A2), but Google sign-in doesn't provide it,
  -- so it's empty until the person adds it. E.164 format: +91 followed by the number.
  phone text unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- Optional; only used for women-only rides (F-F10).
  gender text check (gender in ('female', 'male', 'other')),
  -- For the "Pay by UPI" link (F-D8), e.g. name@okaxis.
  upi_vpa text check (upi_vpa ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$'),
  is_admin boolean not null default false,
  -- Usual commute, as stops rather than exact addresses (F-A6).
  home_place_id uuid references public.places (id) on delete set null,
  work_place_id uuid references public.places (id) on delete set null,
  -- Cached rollup of reliability_events (part 4), recomputed by the daily job (lld.md §3).
  -- Everyone starts at 50.
  reliability_score smallint not null default 50 check (reliability_score between 0 and 100),
  rides_completed integer not null default 0 check (rides_completed >= 0),
  no_shows_90d integer not null default 0 check (no_shows_90d >= 0),
  late_cancels_90d integer not null default 0 check (late_cancels_90d >= 0),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- ---------------------------------------------------------------------------------------------
-- cars: set up once by the owner (F-A3, D7).

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  model text not null
    check (model = btrim(model) and char_length(model) between 2 and 60),
  colour text not null
    check (colour = btrim(colour) and char_length(colour) between 2 and 30),
  -- Stored normalised: upper case, no spaces or dashes ("HR26AB1234"). Only riders with a
  -- confirmed booking on the car's ride may see it (D12, T-1.3).
  plate text not null unique check (plate ~ '^[A-Z0-9]{4,12}$'),
  seats_total smallint not null check (seats_total between 1 and 7),
  -- Paths in Supabase Storage, not URLs: photos are served through signed URLs that expire
  -- (T-2.3), so a stored URL would stop working.
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  created_at timestamptz not null default now()
);

create index cars_owner_id_idx on public.cars (owner_id);

alter table public.cars enable row level security;

-- ---------------------------------------------------------------------------------------------
-- signup_tokens: invite links (Q3). Signing up needs a valid token; admins create them (T-7.3).

create table public.signup_tokens (
  -- At least 22 base64url characters, i.e. about 128 bits of randomness, so tokens can't be
  -- guessed.
  token text primary key check (token ~ '^[A-Za-z0-9_-]{22,}$'),
  created_by uuid not null references public.users (id) on delete cascade,
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (used_count <= max_uses),
  check (expires_at > created_at)
);

alter table public.signup_tokens enable row level security;

-- ---------------------------------------------------------------------------------------------
-- blocks: a blocked pair never matches in search or allocation (F-F8, T-6.5).

create table public.blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Lookups go both ways ("has either of us blocked the other?").
create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
