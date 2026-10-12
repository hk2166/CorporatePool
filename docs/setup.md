# Setup (Phase 0)

Phase 0 of [task.md](../task.md) covers the accounts, keys and data that only a person can
create. It takes about an hour. Do the steps in order and tick each one off in task.md.

| You'll end up with | Where it goes |
|---|---|
| Supabase project URL and two keys | Your password manager now, Vercel later |
| Google sign-in client ID and secret | Supabase dashboard and `.env.local` |
| Push notification (VAPID) key pair | `.env.local` now, Vercel later |
| Docker running on your Mac | Runs the local database that agents build against |
| `supabase/seed/landmarks.csv` | The repo (commit it) |

`.env.local` is git-ignored and must never be committed. For local development it points at the
**local** Supabase in Docker, never at the live database, so agents can't damage real data.

**This Mac, checked 2026-10-12:** Node 22 ✓ · Docker 28, running ✓ · GitHub CLI ✓ ·
Supabase CLI runs through npm (`npx supabase`) and arrives with T-1.1 ✓ · VAPID keys and
`CRON_SECRET` are in `.env.local` ✓ (H-3).

---

## H-1. Supabase project and Vercel account

### Supabase

1. Sign in at [supabase.com](https://supabase.com) with GitHub.
2. Create a project. Name it `corporatepool`, choose the **South Asia (Mumbai)** region and the
   Free plan. Generate a strong database password and save it in your password manager. You'll
   need it later to deploy migrations.
3. When the project is ready, open **Project Settings → API Keys**. Save these three values in
   your password manager:
   - **Project URL** (`https://<ref>.supabase.co`). `<ref>` is your project's ID; you need it in
     H-2.
   - **Publishable key** (older dashboards call it the `anon` key)
   - **Secret key** (older dashboards call it the `service_role` key). It bypasses every
     security rule, so it must only ever be used on the server. Never paste it anywhere public.

These go into Vercel when the app is first deployed. You only need one cloud project, because
local development runs its own database in Docker (H-4). Free projects pause after about a week
with no traffic. Before launch that doesn't matter; you can resume a paused project from the
dashboard.

### Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub on the free **Hobby** plan, and give it
   access to `hk2166/CorporatePool`.
2. **Don't import the project yet.** There's no app until task T-1.1 is merged, so a build now
   would fail. After T-1.1:
   1. **Add New → Project**, import CorporatePool, framework Next.js.
   2. Add the environment variables: the three Supabase values from H-1 and the VAPID values
      from H-3. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL.
   3. If Vercel offers a function region, choose Mumbai (`bom1`) so the app runs close to the
      database.

## H-2. Google sign-in

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project named
   `CorporatePool`.
2. Open **Google Auth Platform** (in the older interface: *APIs & Services → OAuth consent
   screen*):
   - **Branding:** app name CorporatePool, a support email, a developer contact email.
   - **Audience:** External. Leave it in **Testing** for now and add your own Google accounts as
     test users. Testing mode allows up to 100.
   - **Data access:** only the `openid`, `email` and `profile` scopes. These are non-sensitive, so
     making the app public later doesn't need a review by Google.
3. Open **Clients → Create client → Web application** and name it `supabase`:
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs:
     - `https://<ref>.supabase.co/auth/v1/callback`, the live project, with `<ref>` from H-1
     - `http://127.0.0.1:54321/auth/v1/callback`, the local Supabase
   - After the Vercel import, also add the Vercel URL to the origins.
4. Copy the **Client ID** and **Client secret** into two places:
   - Supabase dashboard → **Authentication → Sign In / Providers → Google**: turn it on, paste
     both, and save.
   - `.env.local`, as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
     `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. To create the file, copy `.env.example` to
     `.env.local`. The local Supabase reads these values; T-1.1 sets that up.
5. **Before launch:** go to **Audience → Publish app** so that anyone can sign in, not only your
   test users.

## H-3. Push notification keys (VAPID)

```bash
cd /Users/hemant/Desktop/personal/CorporatePool && npx --yes web-push generate-vapid-keys
```

Copy the output into `.env.local`:
- **Public Key** goes in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Private Key** goes in `VAPID_PRIVATE_KEY`.
- `VAPID_SUBJECT` is a `mailto:` address you read, or an https URL such as the repo's GitHub
  page. Push services use it to contact you
  if something goes wrong.

Generate the keys once and keep using the same pair. If you change them, every existing push
subscription stops working without any error.

## H-4. Local tools

Node 22 and Docker are already set up. Homebrew can't install the Supabase CLI on this Mac, so
the project runs it through npm instead (`npx supabase …`). T-1.1 adds it as a pinned
devDependency when it creates `package.json`. Before any agent starts, check that Docker is
running:

```bash
docker info --format '{{.ServerVersion}}'
```

There's nothing else to install. You don't need the Vercel CLI, because Vercel deploys straight
from GitHub.

## H-5. The stop list

This is the most important step before launch. Search, the seed data and the tests all depend
on the stops, and agents are not allowed to guess them.

**For now the file holds 20 demo stops.** Their names start with `Demo`, and they sit evenly
spaced on a straight line from roughly Palwal to roughly Shankar Chowk. Agents build and test
against them. When you're ready, replace every demo row with a real stop. The launch task
(T-8.2) won't pass while any demo stop is left.

Fill in [`supabase/seed/landmarks.csv`](../supabase/seed/landmarks.csv) with one row per stop:

```csv
name,kind,lat,lng,notes
Shankar Chowk,office,28.xxxxx,77.xxxxx,drop point for the Cyber City offices
```

| Column | What to put |
|---|---|
| `name` | What people call the stop in the WhatsApp group |
| `kind` | `town`, `landmark`, `metro` or `office` |
| `lat`, `lng` | 5 decimal places. In Google Maps, long-press the exact spot where cars stop; the coordinates appear at the top. Tap them to copy. |
| `notes` | Optional, e.g. "petrol pump side", "under the flyover". Put the text in quotes if it contains a comma. |

Which stops to include:
- every pickup point in and around Palwal that cars actually use
- every stop along the way, for **each** route cars take (if some cars go one way and some
  another, include both)
- every drop point in Gurgaon: Shankar Chowk and any others

Aim for 20–40 stops. Use the exact spot where cars stop, not the middle of the area, because
search measures walking distance from that point.

Then check the file:

```bash
cd /Users/hemant/Desktop/personal/CorporatePool && node scripts/check-landmarks.mjs
```

It reports missing columns, unknown kinds, duplicate names, and coordinates outside the Palwal to
Gurgaon area (usually a sign that lat and lng are swapped). It warns about demo stops; add
`--strict` to make them fail, which is what the launch check does.

---

## When you're done

- [ ] `.env.local` has the Google and VAPID values. The Supabase lines get filled from
      `npx supabase status` after `npx supabase start` in T-1.1.
- [ ] The live Supabase values are saved in your password manager.
- [ ] `node scripts/check-landmarks.mjs` passes. Demo stops are fine for now; they must be
      gone before launch.
- [ ] H-1 to H-5 are ticked in task.md, and `landmarks.csv` and task.md are committed.

Then agents can start at T-1.1.
