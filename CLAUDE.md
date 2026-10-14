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
  `supabase/migrations/`.
- Do not guess stop names or coordinates. Landmarks come from `supabase/seed/landmarks.csv`
  (task.md H-5).
