import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { lastSeen } from "@/lib/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { EVENT_LABEL } from "@/lib/reliability";
import { createClient } from "@/lib/supabase/server";
import { describeWeekdays } from "@/lib/usual-ride";

export const metadata: Metadata = { title: "Member · Admin · CorporatePool" };

export default function MemberPage({
  params,
}: PageProps<"/admin/members/[id]">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <AdminNav current="/admin/members" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Member params={params} />
        </Suspense>
      </main>
    </>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILLED = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW"]);

function when(at: string): string {
  return `${dayLabel(indiaDate(new Date(at)))} ${indiaTime(at)}`;
}

function route(stops: { seq: number; label: string }[]): string {
  const sorted = [...stops].sort((a, b) => a.seq - b.seq);
  if (sorted.length === 0) return "No route";
  return `${sorted[0].label} → ${sorted[sorted.length - 1].label}`;
}

// Everything about one member (F-G1 widened): contact, commute, car and usual ride, how often
// they're in the app, their record, and their rides and seats.
async function Member({
  params,
}: {
  params: PageProps<"/admin/members/[id]">["params"];
}) {
  const [{ id }] = await Promise.all([params, getCurrentAdmin()]);
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: m }, offered, taken, events, reports] = await Promise.all([
    supabase.rpc("admin_member", { p_user_id: id }).maybeSingle(),
    supabase
      .from("rides")
      .select(
        "id, depart_at, status, seats_total, hidden_at, ride_stops(seq, label), bookings(seats, status)",
      )
      .eq("owner_id", id)
      .order("depart_at", { ascending: false })
      .limit(15),
    supabase
      .from("bookings")
      .select(
        "id, seats, status, created_at, pickup:ride_stops!bookings_ride_id_pickup_seq_fkey(label), dropoff:ride_stops!bookings_ride_id_drop_seq_fkey(label), ride:rides!bookings_ride_id_fkey(id, depart_at, owner:users!rides_owner_id_fkey(id, name))",
      )
      .eq("rider_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("reliability_events")
      .select("id, kind, points, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("reports")
      .select("id, reason, status, created_at")
      .eq("about_user", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (!m) notFound();
  const today = indiaDate();

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <Link
          href="/admin/members"
          className="inline-flex min-h-10 items-center text-sm underline"
        >
          All members
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {m.name}
          {m.is_admin && (
            <span className="ml-2 align-middle text-sm font-medium text-neutral-500">
              Admin
            </span>
          )}
        </h1>
        {m.removed_at && (
          <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            Removed on {when(m.removed_at)}. Restore them under{" "}
            <Link href="/admin/reports" className="underline">
              Reports
            </Link>
            .
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <Row label="Email">
            {m.email ? (
              <a href={`mailto:${m.email}`} className="underline">
                {m.email}
              </a>
            ) : (
              "–"
            )}
          </Row>
          <Row label="Phone">
            {m.phone ? (
              <a href={`tel:${m.phone}`} className="underline">
                {m.phone}
              </a>
            ) : (
              "Not added yet"
            )}
          </Row>
          <Row label="Commute">
            {m.home && m.work ? `${m.home} → ${m.work}` : "Not set"}
          </Row>
          <Row label="Joined">{when(m.joined_at)}</Row>
          <Row label="Last seen">
            {lastSeen(m.last_active, today)} · in the app {m.active_days_30} of
            the last 30 days
          </Row>
          {m.gender && <Row label="Gender">{m.gender}</Row>}
          {m.upi_vpa && <Row label="UPI">{m.upi_vpa}</Row>}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Car and usual ride</h2>
        {m.car ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Row label="Car">{m.car}</Row>
            <Row label="Plate">{m.plate ?? "–"}</Row>
            <Row label="Usual ride">
              {m.usual_route
                ? `${m.usual_route}, ${m.usual_time?.slice(0, 5)}${
                    m.usual_days
                      ? `, goes live ${describeWeekdays(m.usual_days)}`
                      : ""
                  }`
                : "Not saved"}
            </Row>
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">Doesn&apos;t drive.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Reliability</h2>
        <p className="text-sm">
          Score <span className="font-semibold">{m.reliability_score}</span> ·{" "}
          {m.rides_completed} rides completed · {m.no_shows_90d} no-shows and{" "}
          {m.late_cancels_90d} late cancels in 90 days
        </p>
        {(events.data ?? []).length > 0 && (
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="flex justify-between gap-3 px-4 py-2">
                <span>
                  {EVENT_LABEL[e.kind]}{" "}
                  <span className="text-neutral-500">
                    · {when(e.created_at)}
                  </span>
                </span>
                <span
                  className={`tabular-nums ${e.points < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                >
                  {e.points > 0 ? `+${e.points}` : e.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Rides offered</h2>
        {(offered.data ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            {(offered.data ?? []).map((r) => {
              const filled = r.bookings
                .filter((b) => FILLED.has(b.status))
                .reduce((n, b) => n + b.seats, 0);
              return (
                <li key={r.id}>
                  <Link
                    href={`/rides/${r.id}`}
                    className="flex justify-between gap-3 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span>
                      {when(r.depart_at)} · {route(r.ride_stops)}
                    </span>
                    <span className="whitespace-nowrap text-neutral-500 tabular-nums">
                      {filled}/{r.seats_total} · {r.status.toLowerCase()}
                      {r.hidden_at && " · hidden"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Seats asked for</h2>
        {(taken.data ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
            {(taken.data ?? []).map((b) => (
              <li key={b.id}>
                <Link
                  href={`/rides/${b.ride?.id}`}
                  className="flex justify-between gap-3 px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span>
                    {b.ride ? when(b.ride.depart_at) : "–"} · {b.pickup?.label}{" "}
                    → {b.dropoff?.label}
                    <span className="text-neutral-500">
                      {" "}
                      with {b.ride?.owner?.name ?? "a deleted user"}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-neutral-500">
                    {b.seats > 1 && `${b.seats} seats · `}
                    {b.status.toLowerCase().replace("_", "-")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(reports.data ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Reports about them</h2>
          <ul className="space-y-2 text-sm">
            {(reports.data ?? []).map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-neutral-200 px-4 py-2 dark:border-neutral-800"
              >
                <span className="text-neutral-500">
                  {when(r.created_at)} · {r.status.toLowerCase()}
                </span>
                <p>{r.reason}</p>
              </li>
            ))}
          </ul>
          <Link href="/admin/reports" className="text-sm underline">
            Handle reports
          </Link>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}
