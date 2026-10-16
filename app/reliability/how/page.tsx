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
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          How the reliability score works
        </h1>
        <p>
          Every member has a score from {r.min} to {r.max}. When a car has more
          requests than seats, seats go to the highest scores first, at 22:00
          the evening before. After that, free seats go first come.
        </p>

        <section className="space-y-2">
          <h2 className="font-semibold">The rules</h2>
          <ul className="space-y-1 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <Rule label="Everyone starts at" value={`${r.start}`} />
            <Rule
              label={`Each completed ride (up to +${r.maxFromRides})`}
              value={`+${r.perRide}`}
            />
            <Rule label="Not turning up (a no-show)" value={`${r.noShow}`} />
            <Rule
              label="Cancelling a confirmed seat after 22:00 the evening before"
              value={`${r.lateCancel}`}
            />
          </ul>
          <p className="text-sm text-neutral-500">
            No-shows and late cancels count for {r.windowDays} days, then drop
            off. Completed rides always count. Owners who cancel a ride after
            seats were handed out lose {Math.abs(r.lateCancel)} points too.
            Cancelling a request, or leaving a waitlist, never costs anything.
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
            One no-show costs about a week of commuting to earn back: painful,
            but you can recover.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Fair to riders</h2>
          <p className="text-sm">
            If an owner forgets to mark the ride, everyone counts as having
            ridden. Only the owner of your car can mark you as a no-show, and
            you&apos;re told straight away. If it&apos;s wrong, tell your group
            admin.
          </p>
        </section>

        <Link href="/reliability" className="block text-sm underline">
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
