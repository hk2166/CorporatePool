import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import {
  eventCounts,
  EVENT_LABEL,
  SCORE_RULES,
  type EventKind,
} from "@/lib/reliability";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your reliability · CorporatePool" };

export default function ReliabilityPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <Reliability />
        </Suspense>
      </main>
    </>
  );
}

const BOOKING_LABEL: Record<string, string> = {
  COMPLETED: "Rode",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
  EXPIRED: "Didn't get a seat",
  DECLINED: "Declined",
};

// Your score, how it's made up, and every event behind it (F-F4, F-I2). Every point can be
// traced to a ride.
async function Reliability() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: score }, { data: events }, { data: past }] = await Promise.all(
    [
      supabase.rpc("get_reliability", { p_user_id: user.id }).maybeSingle(),
      supabase
        .from("reliability_events")
        .select(
          "id, kind, points, created_at, booking:bookings(ride:rides(id, depart_at)), ride:rides(id, depart_at)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("bookings")
        .select("id, status, ride:rides!inner(id, depart_at)")
        .eq("rider_id", user.id)
        .in("status", ["COMPLETED", "NO_SHOW", "CANCELLED", "EXPIRED"])
        .order("created_at", { ascending: false })
        .limit(20),
    ],
  );

  const r = SCORE_RULES;
  const rides = score?.rides_completed ?? 0;
  const noShows = score?.no_shows_90d ?? 0;
  const late = score?.late_cancels_90d ?? 0;
  const fromRides = Math.min(r.perRide * rides, r.maxFromRides);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Your reliability
          </h1>
          <p className="text-4xl font-semibold tabular-nums">
            {score?.reliability_score ?? r.start}
          </p>
        </div>
        <dl className="space-y-1 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <Line label="Everyone starts at" value={`${r.start}`} />
          <Line
            label={`${rides} ${rides === 1 ? "ride" : "rides"} completed (+${r.perRide} each, up to +${r.maxFromRides})`}
            value={`+${fromRides}`}
          />
          <Line
            label={`${noShows} no-${noShows === 1 ? "show" : "shows"} in the last ${r.windowDays} days`}
            value={`${r.noShow * noShows}`}
          />
          <Line
            label={`${late} late ${late === 1 ? "cancel" : "cancels"} in the last ${r.windowDays} days`}
            value={`${r.lateCancel * late}`}
          />
        </dl>
        <p className="text-sm text-neutral-500">
          When seats are short, the most reliable riders get them first.{" "}
          <Link href="/reliability/how" className="underline">
            How the score works
          </Link>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">
          What changed your score
        </h2>
        {events && events.length > 0 ? (
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {events.map((e) => {
              const ride = e.booking?.ride ?? e.ride;
              const counts = eventCounts(e.kind as EventKind, e.created_at);
              return (
                <li
                  key={e.id}
                  className="flex items-baseline justify-between gap-3 px-4 py-3"
                >
                  <span className={counts ? "" : "text-neutral-400"}>
                    {EVENT_LABEL[e.kind as EventKind]}
                    <span className="block text-sm text-neutral-500">
                      {ride ? (
                        <Link href={`/rides/${ride.id}`} className="underline">
                          {dayLabel(indiaDate(new Date(ride.depart_at)))} ·{" "}
                          {indiaTime(ride.depart_at)}
                        </Link>
                      ) : (
                        dayLabel(indiaDate(new Date(e.created_at)))
                      )}
                      {!counts && " · older than 90 days, no longer counts"}
                    </span>
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      !counts
                        ? "text-neutral-400 line-through"
                        : e.points > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {e.points > 0 ? `+${e.points}` : e.points}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            Nothing yet. Your first completed ride adds {r.perRide} points.
          </p>
        )}
      </section>

      {past && past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-500">Past rides</h2>
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {past.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/rides/${b.ride.id}`}
                  className="flex justify-between gap-3 px-4 py-3"
                >
                  <span>
                    {dayLabel(indiaDate(new Date(b.ride.depart_at)))} ·{" "}
                    {indiaTime(b.ride.depart_at)}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {BOOKING_LABEL[b.status] ?? b.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-600 dark:text-neutral-400">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
