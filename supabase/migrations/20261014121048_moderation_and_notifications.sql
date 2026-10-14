-- Moderation and notifications (T-1.2, part 5 of 5): reports, admin_actions,
-- push_subscriptions, notifications_outbox.
-- Design: docs/lld.md "Data model" and §6, docs/db-diagram.md.
-- RLS is on with no policies, as in parts 2–4; T-1.3 adds the access rules.

-- ---------------------------------------------------------------------------------------------
-- reports: someone reports a person, optionally about a specific ride (F-F8). Admins work
-- through the open ones (F-G4).

create type public.report_status as enum ('OPEN', 'RESOLVED', 'DISMISSED');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  by_user uuid not null references public.users (id) on delete cascade,
  about_user uuid not null references public.users (id) on delete cascade,
  ride_id uuid references public.rides (id) on delete set null,
  reason text not null
    check (reason = btrim(reason) and char_length(reason) between 5 and 1000),
  status public.report_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (by_user <> about_user),
  -- Only an open report has no resolution time.
  check ((status = 'OPEN') = (resolved_at is null))
);

-- The admin's queue: open reports, oldest first.
create index reports_open_idx on public.reports (created_at) where status = 'OPEN';
create index reports_about_user_idx on public.reports (about_user);

alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------------------------
-- admin_actions: the audit trail of everything an admin does (F-G4, T-7.2). Append-only by
-- design: the admin and everyone it targets are ON DELETE RESTRICT, so the trail can't be
-- erased by deleting an account.

create type public.admin_action_kind as enum (
  'REMOVE_USER', 'RESTORE_USER', 'HIDE_RIDE', 'UNHIDE_RIDE', 'RESOLVE_REPORT', 'DISMISS_REPORT'
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users (id) on delete restrict,
  action public.admin_action_kind not null,
  target_user uuid references public.users (id) on delete restrict,
  target_ride uuid references public.rides (id) on delete restrict,
  target_report uuid references public.reports (id) on delete restrict,
  reason text not null
    check (reason = btrim(reason) and char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  -- Each action names what it acted on.
  check (
    case action
      when 'REMOVE_USER' then target_user is not null
      when 'RESTORE_USER' then target_user is not null
      when 'HIDE_RIDE' then target_ride is not null
      when 'UNHIDE_RIDE' then target_ride is not null
      when 'RESOLVE_REPORT' then target_report is not null
      when 'DISMISS_REPORT' then target_report is not null
    end
  )
);

create index admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index admin_actions_target_user_idx on public.admin_actions (target_user)
  where target_user is not null;

alter table public.admin_actions enable row level security;

-- ---------------------------------------------------------------------------------------------
-- push_subscriptions: one row per browser or phone that allowed notifications (F-E1, T-6.3).
-- These are the Web Push subscription fields the browser hands over.

create table public.push_subscriptions (
  -- The push service URL is unique per browser install.
  endpoint text primary key check (endpoint ~ '^https://'),
  user_id uuid not null references public.users (id) on delete cascade,
  -- The browser's public key (65 bytes, base64url: about 87 characters).
  p256dh text not null check (char_length(p256dh) between 40 and 200),
  -- The shared auth secret (16 bytes, base64url: about 22 characters).
  auth text not null check (char_length(auth) between 16 and 64),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------------------------
-- notifications_outbox (lld.md §6): every notification is written here in the same
-- transaction as the change it announces, then sent by the push sender. A crash between "seat
-- confirmed" and "push sent" therefore loses nothing.

create type public.outbox_status as enum ('PENDING', 'SENT', 'FAILED');

create table public.notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- What happened, in snake_case, e.g. seat_confirmed or ride_cancelled.
  kind text not null check (kind ~ '^[a-z][a-z_]{2,40}$'),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  status public.outbox_status not null default 'PENDING',
  -- The sender gives up after 10 tries and marks it FAILED.
  attempts smallint not null default 0 check (attempts between 0 and 10),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check ((status = 'SENT') = (sent_at is not null))
);

-- The sender drains pending notifications oldest first.
create index notifications_outbox_pending_idx on public.notifications_outbox (created_at)
  where status = 'PENDING';

alter table public.notifications_outbox enable row level security;
