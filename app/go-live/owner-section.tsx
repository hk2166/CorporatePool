import Link from "next/link";
import { addDays, dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { GoLiveCard } from "./go-live-card";

type StoredStop = { label?: string };

// The owner's part of the home page: their upcoming rides, and the Go live card (F-B2).
// Shows a nudge instead when the car or usual ride isn't set up yet.
export async function OwnerSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: car }, { data: usual }, { data: upcoming }] =
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
        .select("id, depart_time, seats_offered, price_per_seat, stops")
        .eq("owner_id", userId)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("rides")
        .select("id, depart_at, seats_total, seats_left, status")
        .eq("owner_id", userId)
        .neq("status", "CANCELLED")
        .gte("depart_at", new Date().toISOString())
        .order("depart_at")
        .limit(5),
    ]);

  if (!car) {
    return (
      <Nudge href="/car" action="Add your car">
        Driving to work with free seats? Set up your car once, then offering a
        ride is one tap.
      </Nudge>
    );
  }
  if (!usual) {
    return (
      <Nudge href="/usual-ride" action="Set up your usual ride">
        Save the ride you usually offer: your stops, time, seats and price.
      </Nudge>
    );
  }

  const today = indiaDate();
  const tomorrow = addDays(today, 1);
  const liveDays = new Set(
    (upcoming ?? []).map((ride) => indiaDate(new Date(ride.depart_at))),
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

  const stops = usual.stops as StoredStop[];
  const route = `${stops[0]?.label ?? "Start"} → ${stops.at(-1)?.label ?? "End"}`;

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
                      <p className="text-sm text-neutral-500">{route}</p>
                    </div>
                    <p className="text-sm">
                      {ride.seats_left === 0
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

      {days.length > 0 && (
        <GoLiveCard
          usualRideId={usual.id}
          days={days}
          defaultDay={days.at(-1)!.value}
          departTime={usual.depart_time.slice(0, 5)}
          seats={usual.seats_offered}
          carSeats={car.seats_total}
          price={usual.price_per_seat}
          route={route}
        />
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
