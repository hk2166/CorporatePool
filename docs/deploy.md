# Launch (T-8.2)

Putting CorporatePool live on the free tiers: the Supabase project from H-1 and a Vercel
project. Everything here is done once, in this order. It needs your accounts, so it's yours to
run; each step says what "done" looks like.

## 1. The real stop list (H-5)

1. Replace the demo stops in `supabase/seed/landmarks.csv` with the real ones, south to north
   (docs/setup.md, H-5, explains the columns).
2. Regenerate the SQL and check there are no demo stops left:

   ```bash
   cd /Users/hemant/Desktop/personal/CorporatePool && npm run seed:landmarks && node scripts/check-landmarks.mjs --strict
   ```

3. Commit both files.

Done when `--strict` prints ✓.

## 2. The database

1. Link the CLI to the live project (it asks for the database password from H-1):

   ```bash
   cd /Users/hemant/Desktop/personal/CorporatePool && npx supabase login && npx supabase link --project-ref lghdujxotdnshnsimabn
   ```

2. Apply every migration. This creates the tables, the access rules and all the scheduled
   jobs:

   ```bash
   cd /Users/hemant/Desktop/personal/CorporatePool && npx supabase db push
   ```

3. In the Supabase dashboard, **SQL Editor**: paste and run `supabase/seed/10_landmarks.sql`
   (the stops). **Never** run `20_demo.sql` there: it creates demo people with a known
   password.

Done when **Database → Cron Jobs** lists `auto-go-live`, `allocate-seats`, `promote-waitlist`,
`rematch-riders`, `expire-rides`, `pickup-reminders`, `recompute-scores` and `send-pushes`, and
**Table Editor → places** shows your stops.

## 3. The app on Vercel

1. **Add New → Project**, import `hk2166/CorporatePool`, framework Next.js. If it offers a
   function region, pick Mumbai (`bom1`).
2. Environment variables (Production), from `.env.local` unless noted:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the live project's URL (Settings → API) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the live project's publishable key |
   | `SUPABASE_SECRET_KEY` | the live project's secret key |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | from H-3 |
   | `CRON_SECRET` | from H-3 (`openssl rand -hex 32` if you need a new one) |
   | `NEXT_PUBLIC_SITE_URL` | the Vercel URL, e.g. `https://corporatepool.vercel.app` |

   Leave `NEXT_PUBLIC_DEV_LOGIN` **unset**: the live app signs in with Google only.
3. Deploy. `vercel.json` adds a daily keep-warm call so the free database never pauses.

Done when the Vercel URL shows the sign-in page.

## 4. Connect the pieces

1. **Supabase → Authentication → URL Configuration:** Site URL = the Vercel URL; add
   `https://<the Vercel URL>/auth/callback` to Redirect URLs.
2. **Supabase → SQL Editor**, so the database can wake the push sender (T-6.3), with the same
   `CRON_SECRET` as in Vercel:

   ```sql
   select vault.create_secret('https://<the Vercel URL>', 'app_url');
   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
   ```

Done when signing in with Google on the Vercel URL lands on "You need an invite".

## 5. Become the admin and invite the group

1. Point `.env.local`'s three Supabase values at the live project for a moment, then:

   ```bash
   cd /Users/hemant/Desktop/personal/CorporatePool && npm run admin:make -- you@gmail.com
   ```

   Point `.env.local` back at the local database afterwards (`npm run db:status`).
2. Reload the app: you're in. **Admin → Invites** makes the link for the WhatsApp group.

## 6. Check it on your phone

- [ ] Install it (Android: Install; iPhone: Share → Add to Home Screen).
- [ ] Profile → Notifications → Turn on.
- [ ] Go live with your usual ride, request a seat from a second account, and watch the
      notification arrive. This also closes T-8.1.
- [ ] Share the ride to WhatsApp: the preview card shows route, time, seats and price.

Then tick T-8.2 (and T-8.1) in task.md.
