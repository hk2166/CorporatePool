import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CompleteRideButton,
  MarkRider,
  StartRideButton,
} from "@/app/rides/[id]/ride-day-controls";
import { AppHeader } from "@/components/app-header";
import { LiveSeatsLeft, LiveSeatsProvider } from "@/components/live-seats";
import { OwnersOnly } from "@/components/owners-only";
import { getCurrentUser } from "@/lib/auth";
import { callLink, displayPhone, whatsappLink } from "@/lib/contact-links";
import { addDays, dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import {
  canStartRide,
  ridersSummary,
  SHOWN_STATUSES,
  shownSince,
  splitRiders,
  stopAt,
  type RideStop,
  type RiderBooking,
} from "@/lib/my-riders";
import { isCarOwner } from "@/lib/ride-preference";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your riders · CorporatePool" };

export default function MyRidersPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 lg:max-w-7xl lg:px-8">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-80 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <MyRiders />
        </Suspense>
      </main>
    </>
  );
}

type Ride = {
  id: string;
  depart_at: string;
  allocation_at: string;
  status: string;
  seats_total: number;
  seats_left: number;
  price_per_seat: number;
  ride_stops: RideStop[];
  bookings: (RiderBooking & { picked_up_at: string | null })[];
};

// Everyone who has booked the owner's upcoming rides, in one place: how many, their names,
// where they get in and out, and their numbers once their seat is confirmed. On the day, the
// owner starts the ride and marks who came here too.
async function MyRiders() {
  const user = await getCurrentUser();
  if (!isCarOwner(user.ridePreference)) {
    return <OwnersOnly what="Your riders" />;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("rides")
    .select(
      "id, depart_at, allocation_at, status, seats_total, seats_left, price_per_seat, ride_stops!ride_stops_ride_id_fkey(seq, label, eta_offset_min), bookings!bookings_ride_id_fkey(id, rider_id, status, seats, waitlist_rank, pickup_seq, drop_seq, created_at, picked_up_at, rider:users!bookings_rider_id_fkey(name))",
    )
    .eq("owner_id", user.id)
    .in("status", SHOWN_STATUSES)
    .gte("depart_at", shownSince())
    .order("depart_at")
    .limit(20);
  const rides: Ride[] = data ?? [];

  // Numbers: the database hands them over for confirmed riders only (get_contact).
  const confirmed = new Set(
    rides.flatMap((r) =>
      r.bookings.filter((b) => b.status === "CONFIRMED").map((b) => b.rider_id),
    ),
  );
  const phones = new Map(
    await Promise.all(
      [...confirmed].map(async (id) => {
        const { data: contact } = await supabase
          .rpc("get_contact", { p_user_id: id })
          .maybeSingle();
        return [id, contact?.phone ?? null] as const;
      }),
    ),
  );

  const today = indiaDate();
  const tomorrow = addDays(today, 1);
  const dayWord = (departAt: string) => {
    const day = indiaDate(new Date(departAt));
    return day === today
      ? "Today"
      : day === tomorrow
        ? "Tomorrow"
        : dayLabel(day);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your riders</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {rides.length > 0
            ? ridersSummary(rides)
            : "You have no upcoming rides."}
        </p>
      </div>

      {rides.length === 0 ? (
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-xl bg-emerald-600 px-5 font-medium text-white"
        >
          Offer a ride from the home page
        </Link>
      ) : (
        // Seats and riders update by themselves while the owner watches.
        <LiveSeatsProvider rideIds={rides.map((r) => r.id)} refresh>
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start 2xl:grid-cols-3">
            {rides.map((ride) => (
              <RideRiders
                key={ride.id}
                ride={ride}
                day={dayWord(ride.depart_at)}
                phones={phones}
              />
            ))}
          </div>
        </LiveSeatsProvider>
      )}
    </div>
  );
}

const callClass =
  "flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-sm font-medium dark:border-neutral-700";
const whatsappClass =
  "flex h-9 items-center rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white";

function RideRiders({
  ride,
  day,
  phones,
}: {
  ride: Ride;
  day: string;
  phones: ReadonlyMap<string, string | null>;
}) {
  const stops = [...ride.ride_stops].sort((a, b) => a.seq - b.seq);
  const { booked, asking, waitlisted } = splitRiders(ride.bookings);
  const at = (seq: number) => stopAt(stops, seq, ride.depart_at);
  const started = ride.status === "STARTED";
  const headingId = `ride-${ride.id}`;
  const handedOut = `${dayLabel(indiaDate(new Date(ride.allocation_at)))} at ${indiaTime(ride.allocation_at)}`;

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id={headingId} className="text-lg font-semibold">
            {day} · {indiaTime(ride.depart_at)}
          </h2>
          <span className="text-sm font-medium">
            <LiveSeatsLeft
              rideId={ride.id}
              seatsLeft={ride.seats_left}
              status={ride.status}
              total={ride.seats_total}
            />
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {stops[0]?.label ?? "Start"} → {stops.at(-1)?.label ?? "End"} · ₹
          {ride.price_per_seat} a seat
        </p>
      </div>

      {booked.length + asking.length + waitlisted.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nobody has booked yet. Share the ride in your WhatsApp group from{" "}
          <Link href={`/rides/${ride.id}`} className="underline">
            its page
          </Link>
          .
        </p>
      )}

      {booked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Booked ({booked.length})</h3>
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {booked.map((b) => {
              const phone = phones.get(b.rider_id);
              return (
                <li key={b.id} className="space-y-1.5 px-3 py-3">
                  <p className="font-medium">
                    {b.rider?.name ?? "A rider"}
                    {b.seats > 1 && (
                      <span className="font-normal text-neutral-500">
                        {" "}
                        · {b.seats} seats
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="block">Gets in at {at(b.pickup_seq)}</span>
                    <span className="block">Gets out at {at(b.drop_seq)}</span>
                  </p>
                  {phone && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm tabular-nums">
                        {displayPhone(phone)}
                      </span>
                      <a href={callLink(phone)} className={callClass}>
                        Call
                      </a>
                      <a
                        href={whatsappLink(phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={whatsappClass}
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                  {started && (
                    <MarkRider
                      bookingId={b.id}
                      mark={
                        b.status === "NO_SHOW"
                          ? "no_show"
                          : b.picked_up_at
                            ? "picked_up"
                            : "none"
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {asking.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Asking for a seat ({asking.length})
          </h3>
          <p className="text-sm text-neutral-500">
            Seats are given out {handedOut}, and riders who always turn up get
            them first. You&apos;ll see their numbers then.
          </p>
          <ul className="space-y-2 text-sm">
            {asking.map((b) => (
              <li key={b.id}>
                <span className="font-medium">
                  {b.rider?.name ?? "A rider"}
                </span>
                {b.seats > 1 && ` · ${b.seats} seats`}
                <span className="block text-neutral-500">
                  {at(b.pickup_seq)} → {at(b.drop_seq)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {waitlisted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Waiting for a free seat ({waitlisted.length})
          </h3>
          <ul className="space-y-2 text-sm">
            {waitlisted.map((b) => (
              <li key={b.id}>
                <span className="font-medium">
                  #{b.waitlist_rank} {b.rider?.name ?? "A rider"}
                </span>
                <span className="block text-neutral-500">
                  {at(b.pickup_seq)} → {at(b.drop_seq)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The day of the ride: start, mark who came, complete. */}
      {canStartRide(ride.depart_at, ride.status) && (
        <StartRideButton rideId={ride.id} />
      )}
      {started && (
        <>
          <p className="text-sm text-neutral-500">
            Tick who came. Anyone you don&apos;t tick counts as having come. Tap
            Finish ride when you arrive.
          </p>
          <CompleteRideButton rideId={ride.id} />
        </>
      )}

      <Link
        href={`/rides/${ride.id}`}
        className="inline-flex min-h-10 items-center text-sm underline"
      >
        Open this ride: notes, share or cancel
      </Link>
    </section>
  );
}
