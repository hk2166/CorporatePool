import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { reliabilityScore, SCORE_RULES } from "@/lib/reliability";

export const metadata: Metadata = {
  title: "How the reliability score works · CorporatePool",
};

const r = SCORE_RULES;

// Worked examples, computed with the same formula as the database (lib/reliability.ts), so the
// page can't drift from the real thing.
const EXAMPLES = [
  { who: "Someone new", rides: 0, noShows: 0, late: 0 },
  { who: "A regular, 20 rides", rides: 20, noShows: 0, late: 0 },
  {
    who: "A regular who missed one ride this month",
    rides: 20,
    noShows: 1,
    late: 0,
  },
  { who: "New, and cancelled late once", rides: 1, noShows: 0, late: 1 },
];

// The rules, open to every member (F-F4): ranking people in secret breeds distrust. Static, so
// it's part of the page shell.
export default function HowTheScoreWorksPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 lg:max-w-2xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          How the reliability score works
        </h1>
        <p>
          Every member has a score from {r.min} to {r.max}. It goes up when you
          turn up for your rides and down when you don&apos;t. Seats go to
          whoever asks first.
        </p>

        <section className="space-y-2">
          <h2 className="font-semibold">The rules</h2>
          <ul className="space-y-1 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <Rule label="Everyone starts at" value={`${r.start}`} />
            <Rule
              label={`Each ride you turn up for (up to +${r.maxFromRides})`}
              value={`+${r.perRide}`}
            />
            <Rule label="Not turning up" value={`${r.noShow}`} />
            <Rule
              label="Cancelling your seat after 10 pm the night before"
              value={`${r.lateCancel}`}
            />
          </ul>
          <p className="text-sm text-neutral-500">
            Not turning up and cancelling late count for {r.windowDays} days,
            then drop off. Rides you turned up for always count. Owners who
            cancel a booked ride after 10 pm the night before lose{" "}
            {Math.abs(r.lateCancel)} points too. Cancelling a request, or
            leaving the waiting list, never costs anything.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Examples</h2>
          <ul className="space-y-1 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            {EXAMPLES.map((e) => (
              <Rule
                key={e.who}
                label={e.who}
                value={`${reliabilityScore({
                  ridesCompleted: e.rides,
                  noShows: e.noShows,
                  lateCancels: e.late,
                })}`}
              />
            ))}
          </ul>
          <p className="text-sm text-neutral-500">
            Not turning up once takes about a week of rides to earn back: it
            hurts, but you can recover.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Fair to riders</h2>
          <p className="text-sm">
            If an owner forgets to tick who came, everyone counts as having
            come. Only the owner of your car can mark you as not coming, and
            you&apos;re told straight away. If it&apos;s wrong, tell your group
            admin.
          </p>
        </section>

        <Link
          href="/reliability"
          className="inline-flex min-h-10 items-center text-sm underline"
        >
          See your own score and history
        </Link>
      </main>
    </>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </li>
  );
}
