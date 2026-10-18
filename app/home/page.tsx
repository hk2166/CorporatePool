import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage } from "@/components/public-page";

export const metadata: Metadata = {
  title: "CorporatePool · Share the ride to work",
  description:
    "CorporatePool matches people driving to work with people going the same way. Free, no ads, no commission.",
};

const FEATURES = [
  {
    title: "Find a seat",
    body: "Search your route and time like booking a cab, and see only the cars that pass near you, with seats left and the price.",
  },
  {
    title: "Fill your empty seats",
    body: "Driving anyway? Save your usual route once, then post it with one tap the evening before. Seat counts look after themselves.",
  },
  {
    title: "Fair when seats are short",
    body: "Free seats go to whoever asks first, and anyone waiting is moved into another car with room, so no car leaves half empty.",
  },
] as const;

const PROMISES = [
  "Free for everyone: no ads, no commission, no fees.",
  "Private by default: phone numbers and number plates are shared only once a seat is confirmed.",
  "The app never handles money: riders pay the driver directly.",
  "Notifications when your seat is confirmed, and a reminder before pickup.",
] as const;

// The public front page (also what Google's brand review looks at): what CorporatePool is,
// with log in and sign up. Static, open to everyone, and not tied to any one city.
export default function HomePage() {
  return (
    <PublicPage>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-16 px-4 pt-10 pb-16 lg:max-w-6xl lg:px-8">
        <section className="space-y-6 text-center sm:text-left">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Share the ride to work.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-neutral-600 sm:mx-0 dark:text-neutral-400">
            CorporatePool matches people who drive to work with people going the
            same way. Owners fill their empty seats, riders get a seat as easily
            as booking a cab, and everyone splits the cost.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-6 font-semibold text-white transition hover:bg-emerald-700"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-6 font-semibold transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Log in
            </Link>
          </div>
          <p className="text-sm text-neutral-500">
            Sign up and log in with your Google account. Commuting groups are
            private: you join through an invite link from your group&apos;s
            admin, or ask to join and an admin lets you in.
          </p>
        </section>

        <section
          className="grid gap-4 sm:grid-cols-3"
          aria-label="How it works"
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="space-y-2 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
            >
              <h2 className="font-semibold">{f.title}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {f.body}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Built for the daily commute
          </h2>
          <ul className="space-y-3">
            {PROMISES.map((p) => (
              <li key={p} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                />
                <span className="text-neutral-700 dark:text-neutral-300">
                  {p}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </PublicPage>
  );
}
