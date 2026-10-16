import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { AddStopLink } from "@/components/add-stop-link";
import { AppHeader } from "@/components/app-header";
import { LiveSeatsProvider } from "@/components/live-seats";
import { RideResultCard } from "@/components/ride-result-card";
import { getCurrentUser } from "@/lib/auth";
import { dayLabel, indiaDate } from "@/lib/india-time";
import {
  dayChoices,
  MAX_SEATS,
  parseSearchQuery,
  searchHref,
  timeWindow,
  type SearchQuery,
} from "@/lib/search-query";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Find a seat · CorporatePool" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-72 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <SearchSection searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

type Place = { id: string; name: string; lat: number; lng: number };

const selectClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// Whole hours a car can reach the pickup stop, for the time window.
const HOURS = Array.from(
  { length: 19 },
  (_, i) => `${String(i + 5).padStart(2, "0")}:00`,
);

// Search like a cab app (F-C1). With nothing chosen yet, it starts from the rider's saved home
// and work stops, so "my usual commute, tomorrow" is a single tap (F-C2).
async function SearchSection({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const [params] = await Promise.all([searchParams, getCurrentUser()]);
  const supabase = await createClient();
  const [{ data: places }, { data: me }] = await Promise.all([
    supabase.rpc("list_places"),
    supabase.rpc("get_my_profile").maybeSingle(),
  ]);

  const today = indiaDate();
  const parsed = parseSearchQuery(params, today);
  const query: SearchQuery = {
    ...parsed,
    from: parsed.from ?? me?.home_place_id ?? null,
    to: parsed.to ?? me?.work_place_id ?? null,
  };
  const byId = new Map((places ?? []).map((p) => [p.id, p]));
  const from = query.from ? byId.get(query.from) : undefined;
  const to = query.to ? byId.get(query.to) : undefined;
  const href = searchHref(query);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Find a seat</h1>

      {/* A plain GET form: works before the page's JavaScript loads, and every search has a
          URL. The key resets the fields when the URL changes (say, after "Going back"). */}
      <Form key={`form:${href}`} action="/search" className="space-y-4">
        <Field label="From" htmlFor="from">
          <select
            id="from"
            name="from"
            required
            defaultValue={from?.id ?? ""}
            className={selectClass}
          >
            <option value="" disabled>
              Where you get in
            </option>
            {(places ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="To" htmlFor="to">
          <select
            id="to"
            name="to"
            required
            defaultValue={to?.id ?? ""}
            className={selectClass}
          >
            <option value="" disabled>
              Where you get out
            </option>
            {(places ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <AddStopLink next="/search" empty={(places ?? []).length === 0} />

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Day" htmlFor="date">
            <select
              id="date"
              name="date"
              defaultValue={query.date}
              className={selectClass}
            >
              {dayChoices(today).map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seats" htmlFor="seats">
            <select
              id="seats"
              name="seats"
              defaultValue={String(query.seats)}
              className={selectClass}
            >
              {Array.from({ length: MAX_SEATS }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Pickup time</legend>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <select
              name="after"
              aria-label="From"
              defaultValue={query.after ?? ""}
              className={selectClass}
            >
              <option value="">Any time</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-sm text-neutral-500">to</span>
            <select
              name="before"
              aria-label="Until"
              defaultValue={query.before ?? ""}
              className={selectClass}
            >
              <option value="">Any time</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <button
          type="submit"
          className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700"
        >
          Search
        </button>
      </Form>

      {from && to && from.id !== to.id ? (
        <Suspense key={`results:${href}`} fallback={<ResultsSkeleton />}>
          <Results query={query} from={from} to={to} today={today} />
        </Suspense>
      ) : (
        <p className="text-sm text-neutral-500">
          {from && to
            ? "Pick two different stops."
            : "Pick where you get in and where you get out."}{" "}
          {!me?.home_place_id && (
            <>
              Save your usual stops on your{" "}
              <Link href="/profile" className="underline">
                profile
              </Link>{" "}
              and this fills itself in.
            </>
          )}
        </p>
      )}
    </div>
  );
}

async function Results({
  query,
  from,
  to,
  today,
}: {
  query: SearchQuery;
  from: Place;
  to: Place;
  today: string;
}) {
  const supabase = await createClient();
  const times = timeWindow(query);
  const { data: rides, error } = await supabase.rpc("search_rides", {
    p_from_lat: from.lat,
    p_from_lng: from.lng,
    p_to_lat: to.lat,
    p_to_lng: to.lng,
    p_date: query.date,
    p_time_from: times.from,
    p_time_to: times.to,
    p_seats: query.seats,
  });

  const day =
    query.date === today
      ? "today"
      : dayChoices(today)[1].value === query.date
        ? "tomorrow"
        : `on ${dayLabel(query.date)}`;
  const reverse = searchHref({ ...query, from: query.to, to: query.from });

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        Search isn&apos;t working right now. Try again in a minute.
      </p>
    );
  }

  return (
    <section className="space-y-3" aria-label="Cars that fit">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">
          {rides.length === 0
            ? `No cars ${day} yet`
            : `${rides.length} ${rides.length === 1 ? "car" : "cars"} ${day}`}
        </h2>
        <Link
          href={reverse}
          className="inline-flex min-h-10 items-center text-sm whitespace-nowrap underline"
        >
          Going back?
        </Link>
      </div>

      {rides.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Owners usually go live the evening before, so check again later.
          {(query.after || query.before) && (
            <>
              {" "}
              Or{" "}
              <Link
                href={searchHref({ ...query, after: null, before: null })}
                className="underline"
              >
                try any time of day
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <LiveSeatsProvider rideIds={rides.map((r) => r.ride_id)}>
          <ul className="space-y-3">
            {rides.map((ride) => (
              <li key={ride.ride_id}>
                <RideResultCard ride={ride} />
              </li>
            ))}
          </ul>
        </LiveSeatsProvider>
      )}
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-32 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-36 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-36 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
