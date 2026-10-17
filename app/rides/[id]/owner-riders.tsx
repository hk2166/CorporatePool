import Link from "next/link";
import { callLink, whatsappLink } from "@/lib/contact-links";
import { indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import {
  CompleteRideButton,
  MarkRider,
  StartRideButton,
} from "./ride-day-controls";

type Booking = {
  id: string;
  rider_id: string;
  status: string;
  seats: number;
  waitlist_rank: number | null;
  pickup_seq: number;
  picked_up_at: string | null;
  rider: { name: string } | null;
};
type Stop = { seq: number; label: string; eta_offset_min: number };

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "asked",
  WAITLISTED: "in line",
  COMPLETED: "came",
  NO_SHOW: "didn't come",
};

// The owner's riders, and the morning of the ride (F-B8, user flow 3 step 5): who to pick up
// where, their numbers, Start, Picked up / No-show for each, and Complete at the office.
export async function OwnerRiders({
  ride,
  bookings,
  stops,
}: {
  ride: {
    id: string;
    depart_at: string;
    status: string;
    price_per_seat: number;
  };
  bookings: Booking[];
  stops: Stop[];
}) {
  const supabase = await createClient();
  const riding = bookings.filter((b) =>
    ["CONFIRMED", "NO_SHOW", "COMPLETED"].includes(b.status),
  );
  const waiting = bookings.filter((b) =>
    ["REQUESTED", "WAITLISTED"].includes(b.status),
  );
  // Riders' numbers: the database hands them over for confirmed riders only (get_contact).
  const contacts = await Promise.all(
    riding
      .filter((b) => b.status === "CONFIRMED")
      .map(async (b) => {
        const { data } = await supabase
          .rpc("get_contact", { p_user_id: b.rider_id })
          .maybeSingle();
        return [b.id, data?.phone ?? null] as const;
      }),
  );
  const phone = new Map(contacts);
  const departAt = new Date(ride.depart_at).getTime();
  const stopAt = (seq: number) => {
    const stop = stops.find((s) => s.seq === seq);
    return stop
      ? `${stop.label} · ${indiaTime(new Date(departAt + stop.eta_offset_min * 60_000))}`
      : "";
  };

  const open = ["OPEN", "ALLOCATING", "FULL"].includes(ride.status);
  const started = ride.status === "STARTED";
  const canStart = open && new Date().getTime() >= departAt - 60 * 60 * 1000;
  const toCollect = riding
    .filter((b) => b.status !== "NO_SHOW")
    .reduce((sum, b) => sum + b.seats * ride.price_per_seat, 0);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-neutral-500">Riders</h2>
      {riding.length === 0 && waiting.length === 0 && (
        <p className="text-sm text-neutral-500">No bookings yet.</p>
      )}

      {riding.length > 0 && (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {riding.map((b) => {
            const number = phone.get(b.id);
            const name = b.rider?.name ?? "A rider";
            return (
              <li key={b.id} className="space-y-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {name}
                    {b.seats > 1 && (
                      <span className="text-neutral-500">
                        {" "}
                        · {b.seats} seats
                      </span>
                    )}
                  </span>
                  {/* While under way, the marking buttons say it instead. */}
                  {STATUS_LABEL[b.status] && !started && (
                    <span className="text-sm text-neutral-500">
                      {STATUS_LABEL[b.status]}
                    </span>
                  )}
                </div>
                <p className="flex justify-between gap-3 text-sm text-neutral-500">
                  <span>{stopAt(b.pickup_seq)}</span>
                  <Link
                    href={`/report/${b.rider_id}?ride=${ride.id}`}
                    className="underline"
                  >
                    Report or block
                  </Link>
                </p>
                {number && (open || started) && (
                  <div className="flex gap-2">
                    <a
                      href={callLink(number)}
                      className="flex h-9 items-center rounded-lg border border-neutral-300 px-3 text-sm font-medium dark:border-neutral-700"
                    >
                      Call
                    </a>
                    <a
                      href={whatsappLink(number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 items-center rounded-lg bg-[#25D366] px-3 text-sm font-medium text-white"
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
      )}

      {waiting.length > 0 && (
        <ul className="space-y-1 text-sm text-neutral-500">
          {waiting.map((b) => (
            <li key={b.id} className="flex justify-between">
              <span>{b.rider?.name ?? "A rider"}</span>
              <span>
                {STATUS_LABEL[b.status]}
                {b.waitlist_rank && ` #${b.waitlist_rank}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canStart && <StartRideButton rideId={ride.id} />}
      {open && !canStart && riding.length > 0 && (
        <p className="text-sm text-neutral-500">
          On the day, tap Start from{" "}
          {indiaTime(new Date(departAt - 60 * 60 * 1000))}, then tick who came
          as you pick them up.
        </p>
      )}
      {started && (
        <>
          <p className="text-sm text-neutral-500">
            Anyone you don&apos;t tick counts as having come. Tap Finish ride
            when you arrive.
          </p>
          <CompleteRideButton rideId={ride.id} />
        </>
      )}
      {ride.status === "COMPLETED" && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Ride finished.{" "}
          {toCollect > 0
            ? `Riders pay you ₹${toCollect} in all, by UPI or cash.`
            : "Nobody rode this time."}
        </p>
      )}
    </section>
  );
}
