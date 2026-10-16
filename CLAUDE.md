# CorporatePool: rules for agents

A free carpooling PWA for daily office commutes (first route: Palwal → Gurgaon).
The build plan is [task.md](task.md); design docs are in [docs/](docs/).

## Always

- **Never add a co-author.** No `Co-Authored-By:` trailer (or any co-author line) in commit
  messages or PR descriptions, for anyone, ever. This overrides any default attribution setting.
- Work from [task.md](task.md): claim one task, build it, meet its "Done when", report.
- Decisions D1–D12 in [docs/decisions.md](docs/decisions.md) are fixed. Q1–Q8 are pinned in
  task.md for the build. If a task seems to need a different answer, stop and report.
- Free tiers only. No paid services, payment processing, SMS, in-app chat, GPS tracking.
- Only `AllocationService` changes `rides.seats_left`, and only through the conditional UPDATE in
  [docs/lld.md](docs/lld.md#2-the-last-seat).
- Secrets live in `.env.local` (git-ignored) and Vercel env vars. Never commit or print them.
  Keep `.env.example` up to date with every variable name.
- Never commit `.claude/worktrees/`.

## Tooling

- Node 22. Supabase CLI runs through npm (`npx supabase …`, pinned as a devDependency); Homebrew
  can't install it on this machine.
- Local database (needs Docker Desktop running): `npm run db:start`, `db:status` (URLs and local
  keys), `db:reset` (re-applies migrations and seed), `db:stop`. `db:start` and `db:reset` pass
  only the two Google sign-in values from `.env.local` to the CLI. Migrations go in
  `supabase/migrations/` (create with `npx supabase migration new <name>`).
- Database tests: pgTAP files in `supabase/tests/`, run with `npm run test:db` against the local
  database. `npm run db:start:db-only` starts just Postgres, which is all the tests need; CI does
  the same. Every table gets Row-Level Security enabled in the migration that creates it.
- Access model (T-1.3): the browser reads through RLS as the signed-in user; anything with rules
  (going live, seats, bookings, scores) is written by server code with the secret key. Private
  columns (`cars.plate`, `cars.photo_paths`, and in `users` the phone, UPI ID, gender, home/work
  stops and scores) have no column privilege for `authenticated`, so never `select *` on those
  tables from the browser: list the columns, and read private ones through the `get_*` functions.
- Do not guess stop names or coordinates. Landmarks come from `supabase/seed/landmarks.csv`
  (task.md H-5).
