import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { percent, sortMembers } from "@/lib/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { addDays, dayLabel, indiaDate } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview · Admin · CorporatePool" };

export default function OverviewPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <AdminNav current="/admin" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Overview />
        </Suspense>
      </main>
    </>
  );
}

const DAYS = 14;

// The admin's front page: today's numbers, the last two weeks day by day, where people are
// going, and who drives and rides the most. The detail is one tab away.
async function Overview() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const today = indiaDate();
  const [summary, daily, trips, members] = await Promise.all([
    supabase.rpc("admin_summary").single(),
    supabase.rpc("admin_daily_stats", {
      p_from: addDays(today, -(DAYS - 1)),
      p_to: today,
    }),
    supabase.rpc("admin_top_trips", {
      p_from: addDays(today, -29),
      p_to: addDays(today, 1),
      p_limit: 8,
    }),
    supabase.rpc("admin_members"),
  ]);
  if (summary.error || daily.error || trips.error || members.error) {
    return <p role="alert">Couldn&apos;t load the overview.</p>;
  }
  const s = summary.data;
  const days = [...daily.data].reverse(); // oldest first, for the chart
  const peak = Math.max(1, ...days.map((d) => d.active_members));
  const tripPeak = Math.max(1, ...trips.data.map((t) => t.trips));
  const current = members.data.filter((m) => !m.removed_at);
  const drivers = sortMembers(current, "driven")
    .filter((m) => m.rides_offered > 0)
    .slice(0, 5);
  const riders = sortMembers(current, "taken")
    .filter((m) => m.rides_taken > 0)
    .slice(0, 5);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        {s.stops === 0 && (
          <Link
            href="/admin/stops"
            className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            There are no stops yet, so nobody can set their commute or search.{" "}
            <span className="font-medium underline">Add stops</span>
          </Link>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Members"
            value={s.members}
            note={`${s.new_members_7d} new this week`}
            href="/admin/members"
          />
          <Stat
            label="Active today"
            value={s.active_today}
            note={`${s.active_7d} this week`}
            href="/admin/members?sort=active"
          />
          <Stat
            label="Rides today"
            value={s.rides_today}
            note={`${s.seats_filled_today} seats filled`}
            href="/admin/rides"
          />
          <Stat
            label="Upcoming rides"
            value={s.rides_upcoming}
            href="/admin/rides"
          />
          <Stat label="Seat requests" value={s.requests_7d} note="this week" />
          <Stat
            label="Open reports"
            value={s.open_reports}
            note={`${s.stops} stops`}
            href="/admin/reports"
            warn={s.open_reports > 0}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Daily users</h2>
        <p className="text-sm text-neutral-500">
          Members who opened the app each day, last {DAYS} days.
        </p>
        <div
          aria-hidden
          className="flex h-40 gap-1 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800"
        >
          {days.map((d) => (
            <div
              key={d.day}
              className="flex h-full flex-1 flex-col items-center gap-1"
            >
              <span className="h-3 text-[10px] leading-3 text-neutral-500 tabular-nums">
                {d.active_members || ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <span
                  className={`w-full rounded-t ${d.day === today ? "bg-emerald-600" : "bg-emerald-400"}`}
                  style={{
                    height: `${Math.round((d.active_members / peak) * 100)}%`,
                    minHeight: d.active_members ? 4 : 1,
                  }}
                />
              </div>
              <span className="text-[10px] text-neutral-500 tabular-nums">
                {Number(d.day.slice(8))}
              </span>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2 font-medium">Rides</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">
                  Seats filled
                </th>
                <th className="px-3 py-2 font-medium">Requests</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {daily.data.map((d) => (
                <tr key={d.day}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {d.day === today ? "Today" : dayLabel(d.day)}
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">
                    {d.active_members}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{d.new_members}</td>
                  <td className="px-3 py-2 tabular-nums">{d.rides}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {d.seats_filled} / {d.seats_offered}{" "}
                    <span className="text-neutral-500">
                      {d.seats_offered > 0 &&
                        percent(d.seats_filled, d.seats_offered)}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{d.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Where people are going</h2>
        <p className="text-sm text-neutral-500">
          Seats asked for, by pickup and drop stop, over the last 30 days and
          tomorrow.
        </p>
        {trips.data.length === 0 ? (
          <p className="text-sm text-neutral-500">No seats asked for yet.</p>
        ) : (
          <ul className="space-y-2">
            {trips.data.map((t) => (
              <li
                key={`${t.pickup}|${t.dropoff}`}
                className="space-y-1 rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {t.pickup} → {t.dropoff}
                  </span>
                  <span className="whitespace-nowrap text-neutral-500 tabular-nums">
                    {t.trips} {t.trips === 1 ? "trip" : "trips"} · {t.riders}{" "}
                    {t.riders === 1 ? "rider" : "riders"}
                  </span>
                </div>
                <span className="block h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <span
                    className="block h-1.5 rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.round((t.trips / tripPeak) * 100)}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <TopList
          title="Top drivers"
          empty="Nobody has offered a ride yet."
          rows={drivers.map((m) => ({
            id: m.user_id,
            name: m.name,
            count: m.rides_offered,
          }))}
          verb="offered"
          more="/admin/members?sort=driven"
        />
        <TopList
          title="Top riders"
          empty="Nobody has taken a ride yet."
          rows={riders.map((m) => ({
            id: m.user_id,
            name: m.name,
            count: m.rides_taken,
          }))}
          verb="taken"
          more="/admin/members?sort=taken"
        />
      </section>
      <p className="text-sm text-neutral-500">
        Reliability ranking (who gets seats first when they&apos;re short) is
        under{" "}
        <Link href="/admin/rankings" className="underline">
          Rankings
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  href,
  warn = false,
}: {
  label: string;
  value: number;
  note?: string;
  href?: string;
  warn?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm text-neutral-500">{label}</p>
      <p
        className={`text-3xl font-semibold tabular-nums ${warn ? "text-amber-600 dark:text-amber-400" : ""}`}
      >
        {value}
      </p>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </>
  );
  const box =
    "block space-y-1 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800";
  return href ? (
    <Link
      href={href}
      className={`${box} transition hover:bg-neutral-50 dark:hover:bg-neutral-900`}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

function TopList({
  title,
  empty,
  rows,
  verb,
  more,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; count: number }[];
  verb: string;
  more: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <ol className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <Link href={`/admin/members/${r.id}`} className="hover:underline">
                <span className="mr-2 text-neutral-500 tabular-nums">
                  {i + 1}.
                </span>
                {r.name}
              </Link>
              <span className="text-neutral-500 tabular-nums">
                {r.count} {r.count === 1 ? "ride" : "rides"} {verb}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Link href={more} className="block text-sm underline">
        See everyone
      </Link>
    </div>
  );
}
