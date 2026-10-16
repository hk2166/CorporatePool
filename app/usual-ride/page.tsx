import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DIRECTIONS,
  parseDirection,
  reverseStops,
  type Direction,
  type StopInput,
} from "@/lib/usual-ride";
import { UsualRideForm } from "./usual-ride-form";

export const metadata: Metadata = { title: "Your rides · CorporatePool" };

export default function UsualRidePage({
  searchParams,
}: PageProps<"/usual-ride">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 md:max-w-xl">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-56 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <UsualRideSection searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

type StoredStop = { place_id?: string; eta_offset_min?: number };

const toInputs = (stops: unknown): StopInput[] =>
  (stops as StoredStop[]).map((stop) => ({
    placeId: stop.place_id ?? "",
    etaOffsetMin: stop.eta_offset_min ?? 0,
  }));

// The owner's usual rides, saved once (F-B1, user flow 2 step 3): the morning one from home to
// the office and the evening one back, each with the stops where they pick people up. Part of
// sign-up for drivers (?welcome=1), after the car.
async function UsualRideSection({
  searchParams,
}: {
  searchParams: PageProps<"/usual-ride">["searchParams"];
}) {
  const [{ welcome }, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const isWelcome = welcome === "1";
  const supabase = await createClient();

  const [{ data: car }, { data: places }, { data: usuals }, { data: me }] =
    await Promise.all([
      supabase
        .from("cars")
        .select("id, seats_total")
        .eq("owner_id", user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("list_places"),
      supabase
        .from("usual_rides")
        .select(
          "id, direction, depart_time, seats_offered, price_per_seat, notes, auto_golive_days, stops",
        )
        .eq("owner_id", user.id),
      supabase.rpc("get_my_profile").maybeSingle(),
    ]);

  if (!car) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your rides</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Add your car first, then set up the rides you usually offer.
        </p>
        <Link
          href="/car"
          className="inline-flex h-12 items-center rounded-xl bg-emerald-600 px-5 font-medium text-white"
        >
          Add my car
        </Link>
      </div>
    );
  }

  const saved = new Map(
    (usuals ?? []).map((u) => [parseDirection(u.direction), u]),
  );
  const morning = saved.get("MORNING");
  const home = me?.home_place_id;
  const work = me?.work_place_id;
  // Where a ride not saved yet starts: the morning one from home to the office; the evening
  // one as the morning one in reverse, or from the office home.
  const suggested: Record<Direction, StopInput[] | undefined> = {
    MORNING:
      home && work
        ? [
            { placeId: home, etaOffsetMin: 0 },
            { placeId: work, etaOffsetMin: 60 },
          ]
        : undefined,
    EVENING: morning
      ? reverseStops(toInputs(morning.stops))
      : home && work
        ? [
            { placeId: work, etaOffsetMin: 0 },
            { placeId: home, etaOffsetMin: 60 },
          ]
        : undefined,
  };
  const placeList = (places ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isWelcome ? "Last step: your rides" : "Your rides"}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Your morning ride to the office and your evening ride home, with the
          stops where you pick people up. Save them once; going live for a day
          is then one tap.
        </p>
        <nav aria-label="Rides" className="flex gap-2 text-sm">
          {DIRECTIONS.map((d) => (
            <a
              key={d.value}
              href={`#${d.word}`}
              className="inline-flex min-h-9 items-center rounded-full border border-neutral-300 px-3 dark:border-neutral-700"
            >
              {d.title}
              {saved.has(d.value) ? "" : " · not set"}
            </a>
          ))}
        </nav>
      </div>
      {DIRECTIONS.map((d) => {
        const usual = saved.get(d.value);
        const stops = usual ? toInputs(usual.stops) : suggested[d.value];
        return (
          <section
            key={d.value}
            id={d.word}
            aria-label={d.title}
            className="scroll-mt-20 space-y-4"
          >
            <h2 className="text-lg font-semibold">{d.title}</h2>
            <UsualRideForm
              direction={d.value}
              defaultTime={d.defaultTime}
              places={placeList}
              car={{ id: car.id, seats: car.seats_total }}
              usualRide={
                usual || stops
                  ? {
                      id: usual?.id ?? "",
                      departTime:
                        usual?.depart_time.slice(0, 5) ?? d.defaultTime,
                      // A new evening ride starts with the morning one's seats and price.
                      seats:
                        usual?.seats_offered ??
                        morning?.seats_offered ??
                        Math.min(3, car.seats_total),
                      price:
                        usual?.price_per_seat ?? morning?.price_per_seat ?? 0,
                      notes: usual?.notes ?? "",
                      autoDays: usual?.auto_golive_days ?? 0,
                      stops: stops ?? [],
                    }
                  : null
              }
            />
          </section>
        );
      })}
      {isWelcome && (
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-medium dark:border-neutral-700"
        >
          Done, take me home
        </Link>
      )}
    </div>
  );
}
