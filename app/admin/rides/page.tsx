import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { splitByDeparture } from "@/lib/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { addDays, dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rides · Admin · CorporatePool" };

export default function RidesPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 lg:max-w-7xl lg:px-8 space-y-6 px-4 py-6">
        <AdminNav current="/admin/rides" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Rides />
        </Suspense>
      </main>
    </>
  );
}

const RECENT_DAYS = 14;
const FILLED = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW"]);
const WAITING = new Set(["REQUESTED", "WAITLISTED"]);

// Every ride from the last two weeks and every one still to come (F-G2 widened): who's
// driving, the route, how full it is and who's still waiting for a seat.
async function Rides() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const since = new Date(
    `${addDays(indiaDate(), -RECENT_DAYS)}T00:00:00+05:30`,
  ).toISOString();
  const { data: rides, error } = await supabase
    .from("rides")
    .select(
      "id, depart_at, status, seats_total, women_only, hidden_at, owner:users!rides_owner_id_fkey(id, name), ride_stops(seq, label), bookings(seats, status)",
    )
    .gte("depart_at", since)
    .order("depart_at", { ascending: false })
    .limit(200);
  if (error) return <p role="alert">Couldn&apos;t load the rides.</p>;

  const { upcoming, past } = splitByDeparture(rides);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Rides</h1>
      <RideList
        title={`Coming up (${upcoming.length})`}
        empty="No rides coming up."
        rides={upcoming}
      />
      <RideList
        title={`Last ${RECENT_DAYS} days (${past.length})`}
        empty="No rides in the last two weeks."
        rides={past}
      />
    </div>
  );
}

type Ride = {
  id: string;
  depart_at: string;
  status: string;
  seats_total: number;
  women_only: boolean;
  hidden_at: string | null;
  owner: { id: string; name: string } | null;
  ride_stops: { seq: number; label: string }[];
  bookings: { seats: number; status: string }[];
};

function RideList({
  title,
  empty,
  rides,
}: {
  title: string;
  empty: string;
  rides: Ride[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rides.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {rides.map((r) => {
            const stops = [...r.ride_stops].sort((a, b) => a.seq - b.seq);
            const filled = r.bookings
              .filter((b) => FILLED.has(b.status))
              .reduce((n, b) => n + b.seats, 0);
            const waiting = r.bookings.filter((b) =>
              WAITING.has(b.status),
            ).length;
            const cancelled = r.status === "CANCELLED";
            return (
              <li
                key={r.id}
                className={`space-y-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800 ${cancelled ? "opacity-60" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/rides/${r.id}`}
                    className="font-medium hover:underline"
                  >
                    {dayLabel(indiaDate(new Date(r.depart_at)))}{" "}
                    {indiaTime(r.depart_at)}
                  </Link>
                  <span className="whitespace-nowrap text-neutral-500">
                    {r.status.toLowerCase()}
                    {r.women_only && " · women only"}
                    {r.hidden_at && " · hidden"}
                  </span>
                </div>
                <p>
                  {stops.length
                    ? stops.map((s) => s.label).join(" → ")
                    : "No route"}
                </p>
                <div className="flex items-center justify-between gap-3 text-neutral-500">
                  <span>
                    {r.owner ? (
                      <Link
                        href={`/admin/members/${r.owner.id}`}
                        className="underline"
                      >
                        {r.owner.name}
                      </Link>
                    ) : (
                      "Deleted user"
                    )}
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                    {filled}/{r.seats_total} filled
                    {waiting > 0 && ` · ${waiting} waiting`}
                    <span className="inline-block h-2 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <span
                        className="block h-2 rounded-full bg-emerald-500"
                        style={{
                          width: `${r.seats_total ? Math.round((filled / r.seats_total) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
