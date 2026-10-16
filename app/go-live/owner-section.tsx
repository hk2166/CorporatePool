import Link from "next/link";
import { addDays, dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import {
  describeWeekdays,
  DIRECTIONS,
  parseDirection,
  weekdayBit,
} from "@/lib/usual-ride";
import { setDaySkipped } from "./actions";
import { GoLiveCard } from "./go-live-card";

type StoredStop = { label?: string };

// The owner's part of the home page: their upcoming rides, and a Go live card for each usual
// ride, morning and evening (F-B2). Nudges instead when the car or the rides aren't set up.
export async function OwnerSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: car }, { data: usuals }, { data: upcoming }] =
    await Promise.all([
      supabase
        .from("cars")
        .select("id, seats_total")
        .eq("owner_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("usual_rides")
        .select(
          "id, direction, depart_time, seats_offered, price_per_seat, stops, auto_golive_days",
        )
        .eq("owner_id", userId),
      supabase
        .from("rides")
        .select("id, usual_ride_id, depart_at, seats_total, seats_left, status")
        .eq("owner_id", userId)
        .not("status", "in", "(CANCELLED,COMPLETED)")
        // A ride that left in the last few hours is still today's: Start, mark, Complete.
        .gte(
          "depart_at",
          new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString(),
        )
        .order("depart_at")
        .limit(6),
    ]);

  if (!car) {
    return (
      <Nudge href="/car" action="Add your car">
        Driving to work with free seats? Set up your car once, then offering a
        ride is one tap.
      </Nudge>
    );
  }
  // Morning first, then evening.
  const rides = DIRECTIONS.flatMap((d) => {
    const usual = (usuals ?? []).find(
      (u) => parseDirection(u.direction) === d.value,
    );
    return usual ? [{ direction: d, usual }] : [];
  });
  if (rides.length === 0) {
    return (
      <Nudge href="/usual-ride" action="Set up your rides">
        Save the rides you usually offer, to the office in the morning and home
        in the evening: your pickup stops, time, seats and price.
      </Nudge>
    );
  }

  const today = indiaDate();
  const tomorrow = addDays(today, 1);
  const routeOf = (stops: unknown) => {
    const list = stops as StoredStop[];
    return `${list[0]?.label ?? "Start"} → ${list.at(-1)?.label ?? "End"}`;
  };
  const routeById = new Map(
    rides.map((r) => [r.usual.id, routeOf(r.usual.stops)]),
  );

  const cards = await Promise.all(
    rides.map(async ({ direction, usual }) => {
      const liveDays = new Set(
        (upcoming ?? [])
          .filter((ride) => ride.usual_ride_id === usual.id)
          .map((ride) => indiaDate(new Date(ride.depart_at))),
      );
      const days = [
        { value: today, label: `Today · ${dayLabel(today)}` },
        { value: tomorrow, label: `Tomorrow · ${dayLabel(tomorrow)}` },
      ]
        // Not a day that's already live, and not today once the usual time has passed.
        .filter((day) => !liveDays.has(day.value))
        .filter(
          (day) =>
            day.value !== today ||
            indiaTime(new Date()) < usual.depart_time.slice(0, 5),
        );
      // Automatic go-live (F-B3): is tomorrow one of the owner's days, and did they skip it?
      const autoTomorrow =
        (usual.auto_golive_days & weekdayBit(tomorrow)) !== 0 &&
        !liveDays.has(tomorrow);
      const { data: skipped } = autoTomorrow
        ? await supabase
            .from("usual_ride_skips")
            .select("day")
            .eq("usual_ride_id", usual.id)
            .eq("day", tomorrow)
            .maybeSingle()
        : { data: null };
      return {
        direction,
        usual,
        days,
        autoTomorrow,
        skipped: Boolean(skipped),
      };
    }),
  );
  const missing = DIRECTIONS.find(
    (d) => !rides.some((r) => r.direction.value === d.value),
  );

  return (
    <section className="space-y-4">
      {upcoming && upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-500">Your rides</h2>
          <ul className="space-y-2">
            {upcoming.map((ride) => {
              const day = indiaDate(new Date(ride.depart_at));
              return (
                <li key={ride.id}>
                  <Link
                    href={`/rides/${ride.id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    <div>
                      <p className="font-medium">
                        {day === today
                          ? "Today"
                          : day === tomorrow
                            ? "Tomorrow"
                            : dayLabel(day)}{" "}
                        · {indiaTime(ride.depart_at)}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {(ride.usual_ride_id &&
                          routeById.get(ride.usual_ride_id)) ??
                          "Your ride"}
                      </p>
                    </div>
                    <p className="text-sm">
                      {ride.status === "STARTED"
                        ? "Under way"
                        : new Date(ride.depart_at) <= new Date()
                          ? "Tap to start"
                          : ride.seats_left === 0
                            ? "Full"
                            : `${ride.seats_left} of ${ride.seats_total} free`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {cards.map(({ direction, usual, days, autoTomorrow, skipped }) => (
        <div key={usual.id} className="space-y-3">
          {usual.auto_golive_days > 0 && (
            <AutoGoLive
              usualRideId={usual.id}
              ride={direction.word}
              tomorrow={tomorrow}
              weekdays={describeWeekdays(usual.auto_golive_days)}
              autoTomorrow={autoTomorrow}
              skipped={skipped}
            />
          )}
          {days.length > 0 && (
            <GoLiveCard
              title={`Offer your ${direction.word} ride`}
              usualRideId={usual.id}
              days={days}
              defaultDay={days.at(-1)!.value}
              departTime={usual.depart_time.slice(0, 5)}
              seats={usual.seats_offered}
              carSeats={car.seats_total}
              price={usual.price_per_seat}
              route={routeOf(usual.stops)}
            />
          )}
        </div>
      ))}

      {missing && (
        <p className="text-sm text-neutral-500">
          Offer your {missing.word} ride too?{" "}
          <Link href={`/usual-ride#${missing.word}`} className="underline">
            Set it up
          </Link>
        </p>
      )}
    </section>
  );
}

function Nudge({
  href,
  action,
  children,
}: {
  href: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-neutral-700 dark:text-neutral-300">{children}</p>
      <Link
        href={href}
        className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-4 font-medium text-white"
      >
        {action}
      </Link>
    </section>
  );
}

// What automatic go-live will do next, with Skip or Undo for tomorrow.
function AutoGoLive({
  usualRideId,
  ride,
  tomorrow,
  weekdays,
  autoTomorrow,
  skipped,
}: {
  usualRideId: string;
  ride: string;
  tomorrow: string;
  weekdays: string;
  autoTomorrow: boolean;
  skipped: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
      <p className="text-neutral-700 dark:text-neutral-300">
        Your {ride} ride goes live automatically on {weekdays}, at 17:00 the day
        before.
      </p>
      {autoTomorrow && (
        <form
          action={setDaySkipped}
          className="flex items-center justify-between gap-3"
        >
          <input type="hidden" name="usualRideId" value={usualRideId} />
          <input type="hidden" name="day" value={tomorrow} />
          <input type="hidden" name="skip" value={skipped ? "0" : "1"} />
          <span className="text-neutral-500">
            {skipped ? "Tomorrow is skipped." : "Not driving tomorrow?"}
          </span>
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium dark:border-neutral-700"
          >
            {skipped ? "Undo" : "Skip tomorrow"}
          </button>
        </form>
      )}
    </div>
  );
}
