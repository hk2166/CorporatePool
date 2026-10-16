import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { lastSeen, sortMembers, splitByDeparture } from "@/lib/admin";
import { getCurrentAdmin } from "@/lib/auth";
import {
  fillPercent,
  RANGES,
  rangeDays,
  SCORE_BANDS,
  scoreBands,
  sum,
  type RangeDays,
} from "@/lib/dashboard";
import { arrangeFeedback } from "@/lib/feedback";
import { addDays, dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import {
  BarList,
  COLOR,
  DataTable,
  Gauge,
  Histogram,
  Panel,
  Stat,
  TimeSeries,
} from "./charts";
import { RefreshPicker } from "./refresh-picker";

export const metadata: Metadata = {
  title: "Dashboard · Admin · CorporatePool",
};

// The admin's single-page dashboard, Grafana style: every number in the app on one dark page,
// over a chosen time range, refreshing itself. The other admin tabs are where things get done;
// this is for watching.
export default function DashboardPage({
  searchParams,
}: PageProps<"/admin/dashboard">) {
  return (
    <main className="flex-1 bg-[#111217] text-[#ccccdc]">
      <Suspense fallback={<Skeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const ACTION_LABEL: Record<string, string> = {
  REMOVE_USER: "removed",
  RESTORE_USER: "restored",
  HIDE_RIDE: "hid a ride",
  UNHIDE_RIDE: "unhid a ride",
  RESOLVE_REPORT: "resolved a report",
  DISMISS_REPORT: "dismissed a report",
};
const FILLED = new Set(["CONFIRMED", "COMPLETED", "NO_SHOW"]);

function when(at: string): string {
  return `${dayLabel(indiaDate(new Date(at)))} ${indiaTime(at)}`;
}

function scoreColor(score: number): string {
  return score < 40 ? COLOR.red : score < 60 ? COLOR.yellow : COLOR.green;
}

// The time the numbers were read, in India.
function readAt(): string {
  return indiaTime(new Date());
}

async function Dashboard({
  searchParams,
}: {
  searchParams: PageProps<"/admin/dashboard">["searchParams"];
}) {
  const [params] = await Promise.all([searchParams, getCurrentAdmin()]);
  const range = rangeDays(params.range);
  const today = indiaDate();
  const from = addDays(today, -(range - 1));
  const supabase = await createClient();
  const [summary, daily, trips, members, waiting, feedback, rides, actions] =
    await Promise.all([
      supabase.rpc("admin_summary").single(),
      supabase.rpc("admin_daily_stats", { p_from: from, p_to: today }),
      supabase.rpc("admin_top_trips", {
        p_from: from,
        p_to: addDays(today, 1),
        p_limit: 8,
      }),
      supabase.rpc("admin_members"),
      supabase
        .from("join_requests")
        .select("user_id, name, email, created_at", { count: "exact" })
        .eq("status", "PENDING")
        .order("created_at")
        .limit(6),
      supabase.rpc("list_feedback"),
      supabase
        .from("rides")
        .select(
          "id, depart_at, status, seats_total, owner:users!rides_owner_id_fkey(id, name), ride_stops(seq, label), bookings(seats, status)",
        )
        .gte("depart_at", `${today}T00:00:00+05:30`)
        .neq("status", "CANCELLED")
        .order("depart_at", { ascending: false })
        .limit(40),
      supabase
        .from("admin_actions")
        .select(
          "id, action, reason, created_at, admin:users!admin_actions_admin_id_fkey(name), target:users!admin_actions_target_user_fkey(name)",
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
  if (summary.error || daily.error || trips.error || members.error) {
    return (
      <>
        <Toolbar range={range} />
        <p role="alert" className="p-4">
          Couldn&apos;t load the dashboard.
        </p>
      </>
    );
  }

  // Day by day, oldest first.
  const days = [...daily.data].reverse();
  const keys = days.map((d) => d.day);
  const active = days.map((d) => d.active_members);
  const joined = days.map((d) => d.new_members);
  const ridesPerDay = days.map((d) => d.rides);
  const offered = days.map((d) => d.seats_offered);
  const filled = days.map((d) => d.seats_filled);
  const requests = days.map((d) => d.requests);
  const fill = fillPercent(sum(filled), sum(offered));
  const fillPerDay = days.map(
    (d) => fillPercent(d.seats_filled, d.seats_offered) ?? 0,
  );

  const s = summary.data;
  const memberGrowth = joined.reduce<number[]>(
    (acc, n) => [...acc, (acc.at(-1) ?? s.members - sum(joined)) + n],
    [],
  );
  const current = members.data.filter((m) => !m.removed_at);
  const activeInRange = current.filter(
    (m) => m.last_active !== null && m.last_active >= from,
  ).length;
  const drivers = sortMembers(current, "driven").filter((m) => m.rides_offered);
  const riders = sortMembers(current, "taken").filter((m) => m.rides_taken);
  const regulars = sortMembers(current, "active").filter(
    (m) => m.active_days_30,
  );
  const wanted = arrangeFeedback(feedback.data ?? [], "top").open;
  const upcoming = splitByDeparture(rides.data ?? []).upcoming.slice(0, 10);
  const waitingCount = waiting.count ?? 0;

  return (
    <>
      <Toolbar range={range} />
      <p className="px-3 pt-2 text-xs text-[#8e8e9e]">
        Last {range} days, India time · read at {readAt()}
      </p>
      <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-12">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:col-span-12 xl:grid-cols-8">
          <Stat
            title="Members"
            value={s.members}
            note={`+${sum(joined)} in ${range} days`}
            color={COLOR.blue}
            spark={memberGrowth}
            href="/admin/members"
          />
          <Stat
            title="Active today"
            value={s.active_today}
            note={`${activeInRange} in ${range} days`}
            color={COLOR.green}
            spark={active}
            href="/admin/members?sort=active"
          />
          <Stat
            title="Rides today"
            value={s.rides_today}
            note={`${s.rides_upcoming} coming up`}
            color={COLOR.purple}
            spark={ridesPerDay}
            href="/admin/rides"
          />
          <Stat
            title="Seats filled"
            value={fill ?? "–"}
            unit={fill === null ? undefined : "%"}
            note={`${sum(filled)} of ${sum(offered)} seats`}
            color={
              fill === null
                ? COLOR.muted
                : fill < 40
                  ? COLOR.red
                  : fill < 70
                    ? COLOR.yellow
                    : COLOR.green
            }
            spark={fillPerDay}
            href="/admin/occupancy"
          />
          <Stat
            title="Seat requests"
            value={sum(requests)}
            note={`in ${range} days`}
            color={COLOR.orange}
            spark={requests}
          />
          <Stat
            title="Waiting to join"
            value={waitingCount}
            note="join requests"
            color={waitingCount ? COLOR.yellow : COLOR.green}
            href="/admin/requests"
          />
          <Stat
            title="Open reports"
            value={s.open_reports}
            note={`${s.stops} stops`}
            color={s.open_reports ? COLOR.red : COLOR.green}
            href="/admin/reports"
          />
          <Stat
            title="Open feedback"
            value={wanted.length}
            note={
              wanted[0]
                ? `top has ${wanted[0].votes} ${wanted[0].votes === 1 ? "vote" : "votes"}`
                : "nothing yet"
            }
            color={COLOR.blue}
            href="/admin/feedback"
          />
        </div>

        <Panel title="Daily active members" className="md:col-span-8">
          <TimeSeries
            days={keys}
            series={[
              {
                name: "Active members",
                color: COLOR.green,
                values: active,
                kind: "area",
              },
              {
                name: "New members",
                color: COLOR.blue,
                values: joined,
                kind: "bars",
              },
            ]}
          />
        </Panel>
        <Panel title="Seat fill rate" className="md:col-span-4">
          <div className="flex h-full flex-col justify-between gap-3">
            <Gauge percent={fill} label={`Seats filled, last ${range} days`} />
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Rides", sum(ridesPerDay)],
                ["Offered", sum(offered)],
                ["Filled", sum(filled)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-sm bg-[#111217] py-2">
                  <dt className="text-[11px] text-[#8e8e9e]">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>

        <Panel title="Rides and seats per day" className="md:col-span-6">
          <TimeSeries
            days={keys}
            series={[
              {
                name: "Seats offered",
                color: COLOR.blue,
                values: offered,
                kind: "bars",
              },
              {
                name: "Seats filled",
                color: COLOR.green,
                values: filled,
                kind: "bars",
              },
              {
                name: "Rides",
                color: COLOR.purple,
                values: ridesPerDay,
                kind: "line",
              },
            ]}
          />
        </Panel>
        <Panel title="Seat requests per day" className="md:col-span-6">
          <TimeSeries
            days={keys}
            series={[
              {
                name: "Seat requests",
                color: COLOR.orange,
                values: requests,
                kind: "area",
              },
            ]}
          />
        </Panel>

        <Panel
          title={`Where people are going (${range} days)`}
          className="md:col-span-6"
        >
          <BarList
            rows={trips.data.map((t) => ({
              key: `${t.pickup}|${t.dropoff}`,
              label: `${t.pickup} → ${t.dropoff}`,
              value: t.trips,
            }))}
            color={COLOR.blue}
            unit={(n) => `${n} ${n === 1 ? "trip" : "trips"}`}
            empty="No seats asked for in this range."
          />
        </Panel>
        <Panel title="Reliability scores" className="md:col-span-3">
          <Histogram
            bands={SCORE_BANDS}
            counts={scoreBands(current.map((m) => m.reliability_score))}
            colors={[
              COLOR.red,
              COLOR.orange,
              COLOR.yellow,
              COLOR.green,
              COLOR.green,
            ]}
          />
          <p className="mt-2 text-xs text-[#8e8e9e]">
            Members by score. Higher scores get seats first.{" "}
            <Link href="/admin/rankings" className="text-[#6e9fff]">
              Rankings
            </Link>
          </p>
        </Panel>
        <Panel title="Most active (30 days)" className="md:col-span-3">
          <BarList
            rows={regulars.slice(0, 6).map((m) => ({
              key: m.user_id,
              label: <MemberLink id={m.user_id} name={m.name} />,
              value: m.active_days_30,
            }))}
            color={COLOR.green}
            unit={(n) => `${n} ${n === 1 ? "day" : "days"}`}
            empty="Nobody yet."
          />
        </Panel>

        <Panel title="Top drivers" className="md:col-span-4">
          <BarList
            rows={drivers.slice(0, 6).map((m) => ({
              key: m.user_id,
              label: <MemberLink id={m.user_id} name={m.name} />,
              value: m.rides_offered,
            }))}
            color={COLOR.purple}
            unit={(n) => `${n} ${n === 1 ? "ride" : "rides"}`}
            empty="Nobody has offered a ride yet."
          />
        </Panel>
        <Panel title="Top riders" className="md:col-span-4">
          <BarList
            rows={riders.slice(0, 6).map((m) => ({
              key: m.user_id,
              label: <MemberLink id={m.user_id} name={m.name} />,
              value: m.rides_taken,
            }))}
            color={COLOR.orange}
            unit={(n) => `${n} ${n === 1 ? "ride" : "rides"}`}
            empty="Nobody has taken a ride yet."
          />
        </Panel>
        <Panel
          title="Most wanted feedback"
          href="/admin/feedback"
          className="md:col-span-4"
        >
          <BarList
            rows={wanted.slice(0, 6).map((f) => ({
              key: f.id,
              label: f.title,
              value: f.votes,
            }))}
            color={COLOR.yellow}
            unit={(n) => `${n} ${n === 1 ? "vote" : "votes"}`}
            empty="No feedback yet."
          />
        </Panel>

        <Panel
          title="Upcoming rides"
          href="/admin/rides"
          className="md:col-span-8"
        >
          <DataTable
            head={[
              { label: "Leaves" },
              { label: "Driver" },
              { label: "Route" },
              { label: "Filled", align: "right" },
              { label: "Status" },
            ]}
            rows={upcoming.map((r) => {
              const stops = [...r.ride_stops].sort((a, b) => a.seq - b.seq);
              const seats = r.bookings
                .filter((b) => FILLED.has(b.status))
                .reduce((n, b) => n + b.seats, 0);
              return {
                key: r.id,
                cells: [
                  <Link
                    key="when"
                    href={`/rides/${r.id}`}
                    className="text-[#6e9fff] hover:underline"
                  >
                    {when(r.depart_at)}
                  </Link>,
                  r.owner ? (
                    <MemberLink
                      key="driver"
                      id={r.owner.id}
                      name={r.owner.name}
                    />
                  ) : (
                    "Deleted user"
                  ),
                  stops.length
                    ? `${stops[0].label} → ${stops[stops.length - 1].label}`
                    : "–",
                  `${seats}/${r.seats_total}`,
                  r.status.toLowerCase(),
                ],
              };
            })}
            empty="No rides coming up."
          />
        </Panel>
        <Panel
          title={`Waiting to join (${waitingCount})`}
          href="/admin/requests"
          className="md:col-span-4"
        >
          {(waiting.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-[#8e8e9e]">
              Nobody is waiting.
            </p>
          ) : (
            <ul className="divide-y divide-[#22252b] text-[13px]">
              {(waiting.data ?? []).map((r) => (
                <li key={r.user_id} className="py-1.5">
                  <p className="truncate">{r.name}</p>
                  <p className="truncate text-xs text-[#8e8e9e]">
                    {r.email} · {when(r.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={`Members (${current.length})`}
          href="/admin/members"
          className="md:col-span-8"
        >
          <DataTable
            head={[
              { label: "Member" },
              { label: "Last seen" },
              { label: "Days in app (30)", align: "right" },
              { label: "Offered", align: "right" },
              { label: "Taken", align: "right" },
              { label: "Score", align: "right" },
            ]}
            rows={sortMembers(current, "active")
              .slice(0, 50)
              .map((m) => ({
                key: m.user_id,
                cells: [
                  <MemberLink key="name" id={m.user_id} name={m.name} />,
                  lastSeen(m.last_active, today),
                  m.active_days_30,
                  m.rides_offered,
                  m.rides_taken,
                  <span
                    key="score"
                    className="font-semibold"
                    style={{ color: scoreColor(m.reliability_score) }}
                  >
                    {m.reliability_score}
                  </span>,
                ],
              }))}
            empty="No members yet."
          />
        </Panel>
        <Panel
          title="Admin activity"
          href="/admin/reports"
          className="md:col-span-4"
        >
          {(actions.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-[#8e8e9e]">
              No admin actions yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#22252b] text-[13px]">
              {(actions.data ?? []).map((a) => (
                <li key={a.id} className="py-1.5">
                  <p className="truncate">
                    {a.admin?.name ?? "An admin"} {ACTION_LABEL[a.action]}
                    {a.target?.name && ` ${a.target.name}`}
                  </p>
                  <p className="truncate text-xs text-[#8e8e9e]">
                    {when(a.created_at)} · {a.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function MemberLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/members/${id}`} className="hover:underline">
      {name}
    </Link>
  );
}

// The bar across the top: where you are, the time range, and refreshing.
function Toolbar({ range }: { range: RangeDays }) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#2c3036] bg-[#111217]/95 px-3 py-2 backdrop-blur">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-sm"
      >
        <Link href="/" className="font-semibold">
          CorporatePool
        </Link>
        <span className="text-[#8e8e9e]">/</span>
        <Link href="/admin" className="text-[#8e8e9e] hover:text-[#ccccdc]">
          Admin
        </Link>
        <span className="text-[#8e8e9e]">/</span>
        <h1 className="font-medium">Dashboard</h1>
      </nav>
      <div className="flex items-center gap-2">
        <nav
          aria-label="Time range"
          className="flex h-8 overflow-hidden rounded-[3px] border border-[#2c3036] text-[13px]"
        >
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/dashboard?range=${r}`}
              aria-current={r === range ? "true" : undefined}
              className={`flex items-center border-l border-[#2c3036] px-2.5 first:border-l-0 ${
                r === range
                  ? "bg-[#3d71d9] text-white"
                  : "bg-[#181b1f] hover:bg-[#22252b]"
              }`}
            >
              {r}d
            </Link>
          ))}
        </nav>
        <RefreshPicker />
      </div>
    </header>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 p-2 pt-14 md:grid-cols-12">
      {[
        "md:col-span-12",
        "md:col-span-8",
        "md:col-span-4",
        "md:col-span-6",
        "md:col-span-6",
      ].map((span, i) => (
        <div
          key={i}
          className={`h-48 animate-pulse rounded-[3px] bg-[#181b1f] ${span}`}
        />
      ))}
    </div>
  );
}
