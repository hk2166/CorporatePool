import Link from "next/link";
import { LiveSeatsLeft } from "@/components/live-seats";
import type { Database } from "@/lib/database.types";
import { indiaTime } from "@/lib/india-time";
import { walkLabel } from "@/lib/search-query";

export type RideResult =
  Database["public"]["Functions"]["search_rides"]["Returns"][number];

const BOOKING_LABEL: Record<string, string> = {
  REQUESTED: "You've requested a seat",
  CONFIRMED: "Your seat is confirmed",
  WAITLISTED: "You're on the waitlist",
};

// One car in the search results (user flow 1 step 4): when it reaches the rider's stop, the
// price, seats left, who's driving and how far the stops are. No phone numbers or plates.
// The seat count is live when the card sits inside a <LiveSeatsProvider>.
export function RideResultCard({ ride }: { ride: RideResult }) {
  const walk = ride.pickup_walk_m + ride.drop_walk_m;
  return (
    <Link
      href={`/r/${ride.ride_id}`}
      className="block space-y-3 rounded-2xl border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight">
          {indiaTime(ride.pickup_at)}
        </p>
        <p className="text-lg font-semibold">₹{ride.price_per_seat}</p>
      </div>

      <div className="space-y-0.5">
        <p>
          {ride.pickup_label} → {ride.drop_label}{" "}
          <span className="text-neutral-500">
            · there by {indiaTime(ride.drop_at)}
          </span>
        </p>
        <p className="text-sm text-neutral-500">
          {walk < 100
            ? "Stops right where you are"
            : `Pickup ${walkLabel(ride.pickup_walk_m)}, drop ${walkLabel(ride.drop_walk_m)}`}
          {ride.pickup_seq > 0 && ` · car starts at ${ride.start_label}`}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar
            name={ride.owner_first_name}
            photoUrl={ride.owner_photo_url}
          />
          <span className="truncate">
            {ride.owner_first_name} · {ride.car_colour} {ride.car_model}
          </span>
        </span>
        <LiveSeatsLeft
          rideId={ride.ride_id}
          seatsLeft={ride.seats_left}
          status={ride.status}
        />
      </div>

      {(ride.women_only || ride.my_booking_status) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {ride.women_only && (
            <span className="rounded-full bg-pink-100 px-3 py-1 text-pink-800 dark:bg-pink-950 dark:text-pink-300">
              Women only
            </span>
          )}
          {ride.my_booking_status && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {BOOKING_LABEL[ride.my_booking_status]}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      // A 24 px Google profile photo: not worth the image optimiser.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        width={24}
        height={24}
        referrerPolicy="no-referrer"
        className="h-6 w-6 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-medium dark:bg-neutral-700"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
