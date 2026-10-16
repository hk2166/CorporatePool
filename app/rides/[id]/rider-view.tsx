import Link from "next/link";
import { LiveSeatsLeft, LiveSeatsProvider } from "@/components/live-seats";
import { callLink, upiLink, whatsappLink } from "@/lib/contact-links";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { CancelBookingForm, RequestSeatForm } from "./rider-forms";

export type RideRow = {
  id: string;
  owner_id: string;
  car_id: string;
  depart_at: string;
  allocation_at: string;
  seats_total: number;
  seats_left: number;
  price_per_seat: number;
  notes: string | null;
  status: string;
  women_only: boolean;
};

const MAX_SEATS = 4;

// A ride as a rider sees it (user flow 1 steps 5–7): ask for a seat, see where you stand, and
// once your seat is confirmed, the car, the owner's number and Pay by UPI (F-D8).
export async function RiderView({
  ride,
  userId,
  pickup,
  drop,
}: {
  ride: RideRow;
  userId: string;
  // Stops picked in search, if the rider came from there.
  pickup?: number;
  drop?: number;
}) {
  const supabase = await createClient();
  const [{ data: stops }, { data: owner }, { data: car }, { data: booking }] =
    await Promise.all([
      supabase
        .from("ride_stops")
        .select("seq, label, eta_offset_min")
        .eq("ride_id", ride.id)
        .order("seq"),
      supabase
        .from("users")
        .select("name, photo_url")
        .eq("id", ride.owner_id)
        .maybeSingle(),
      supabase
        .from("cars")
        .select("model, colour")
        .eq("id", ride.car_id)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select(
          "id, status, waitlist_rank, pickup_seq, drop_seq, seats, any_car_ok",
        )
        .eq("ride_id", ride.id)
        .eq("rider_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const departAt = new Date(ride.depart_at).getTime();
  const route = (stops ?? []).map((s) => ({
    seq: s.seq,
    label: s.label,
    time: indiaTime(new Date(departAt + s.eta_offset_min * 60_000)),
  }));
  const ownerFirstName = (owner?.name ?? "The owner").split(" ")[0];
  const now = new Date().getTime();
  const allocated = now >= new Date(ride.allocation_at).getTime();
  const open =
    ["OPEN", "ALLOCATING", "FULL"].includes(ride.status) && departAt > now;
  const active =
    booking && ["REQUESTED", "CONFIRMED", "WAITLISTED"].includes(booking.status)
      ? booking
      : null;
  const finished =
    booking !== null && ["COMPLETED", "NO_SHOW"].includes(booking.status);
  const stopLabel = (seq: number) => route.find((s) => s.seq === seq);

  const last = route.length - 1;
  const defaultPickup =
    pickup !== undefined && pickup >= 0 && pickup < last ? pickup : 0;
  const defaultDrop =
    drop !== undefined && drop > defaultPickup && drop <= last ? drop : last;

  return (
    <LiveSeatsProvider rideIds={[ride.id]}>
      <div className="space-y-6">
        <header className="space-y-1">
          <p className="text-sm text-neutral-500">
            {dayLabel(indiaDate(new Date(ride.depart_at)))} · with{" "}
            {ownerFirstName} · {car ? `${car.colour} ${car.model}` : "car"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {route[0]?.label} → {route[last]?.label}
          </h1>
          <p className="text-lg">
            <LiveSeatsLeft
              rideId={ride.id}
              seatsLeft={ride.seats_left}
              status={ride.status}
            />{" "}
            · ₹{ride.price_per_seat} a seat
          </p>
          {ride.women_only && (
            <p className="inline-block rounded-full bg-pink-100 px-3 py-1 text-sm text-pink-800 dark:bg-pink-950 dark:text-pink-300">
              Women only
            </p>
          )}
          {ride.notes && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {ride.notes}
            </p>
          )}
        </header>

        <ol className="space-y-2 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
          {route.map((s) => (
            <li key={s.seq} className="flex justify-between gap-3">
              <span>{s.label}</span>
              <span className="text-sm text-neutral-500">{s.time}</span>
            </li>
          ))}
        </ol>

        {active?.status === "REQUESTED" && (
          <Status title="Seat requested" tone="neutral">
            Seats for this ride are handed out at{" "}
            {indiaTime(ride.allocation_at)}{" "}
            {indiaDate(new Date(ride.allocation_at)) === indiaDate()
              ? "today"
              : dayLabel(indiaDate(new Date(ride.allocation_at)))}
            , most reliable riders first. We&apos;ll let you know.
          </Status>
        )}
        {active?.status === "WAITLISTED" && (
          <Status
            title={`You're #${active.waitlist_rank} on the waitlist`}
            tone="neutral"
          >
            If a seat comes free, it&apos;s yours automatically.
            {active.any_car_ok &&
              " If another car on your route has room, we'll move you there."}
          </Status>
        )}
        {active?.status === "CONFIRMED" && (
          <Confirmed
            ride={ride}
            seats={active.seats}
            pickup={stopLabel(active.pickup_seq)}
            drop={stopLabel(active.drop_seq)}
          />
        )}
        {booking?.status === "COMPLETED" && (
          <Completed
            ride={ride}
            seats={booking.seats}
            ownerFirstName={ownerFirstName}
          />
        )}
        {booking?.status === "NO_SHOW" && (
          <Status title="Marked as a no-show" tone="bad">
            {ownerFirstName} marked you as not turning up, which costs 15
            reliability points. If that&apos;s wrong, tell your group admin.
          </Status>
        )}

        {active && open && (
          <CancelBookingForm
            bookingId={active.id}
            label={
              active.status === "CONFIRMED"
                ? "Cancel my seat"
                : active.status === "WAITLISTED"
                  ? "Leave the waitlist"
                  : "Withdraw my request"
            }
            warning={
              active.status === "CONFIRMED"
                ? allocated
                  ? "Seats were handed out at 22:00, so cancelling now counts as a late cancel and costs you 5 reliability points. Your seat goes straight to the next rider waiting."
                  : "Your seat goes straight to the next rider waiting."
                : undefined
            }
          />
        )}

        {!active && !finished && open && (
          <RequestSeatForm
            rideId={ride.id}
            stops={route}
            pickup={defaultPickup}
            drop={defaultDrop}
            maxSeats={Math.min(MAX_SEATS, ride.seats_total)}
            note={
              allocated
                ? "Free seats go first come. If the car is full, you join the waitlist."
                : `Requests are collected until ${indiaTime(ride.allocation_at)} the evening before, then seats go to the most reliable riders. Being quick doesn't matter.`
            }
          />
        )}

        {!active && !open && !booking && (
          <p className="text-sm text-neutral-500">
            This ride isn&apos;t taking requests any more.{" "}
            <Link href="/search" className="underline">
              Find another seat
            </Link>
          </p>
        )}
      </div>
    </LiveSeatsProvider>
  );
}

// The confirmed view (F-D8): the car, the owner's number, WhatsApp, and Pay by UPI. The
// database only hands these over to a rider with a confirmed seat (get_contact,
// get_car_private).
async function Confirmed({
  ride,
  seats,
  pickup,
  drop,
}: {
  ride: RideRow;
  seats: number;
  pickup?: { label: string; time: string };
  drop?: { label: string; time: string };
}) {
  const supabase = await createClient();
  const [{ data: contact }, { data: carPrivate }] = await Promise.all([
    supabase.rpc("get_contact", { p_user_id: ride.owner_id }).maybeSingle(),
    supabase.rpc("get_car_private", { p_car_id: ride.car_id }).maybeSingle(),
  ]);
  const paths = carPrivate?.photo_paths ?? [];
  const { data: photos } = paths.length
    ? await supabase.storage.from("car-photos").createSignedUrls(paths, 3600)
    : { data: [] };
  const firstName = contact?.name.split(" ")[0] ?? "the owner";
  const amount = ride.price_per_seat * seats;

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
      <div>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          Your seat is confirmed
        </h2>
        {pickup && (
          <p className="text-emerald-900 dark:text-emerald-200">
            Be at {pickup.label} by {pickup.time}
            {drop && ` · out at ${drop.label}`}
            {seats > 1 && ` · ${seats} seats`}
          </p>
        )}
      </div>

      {(photos ?? []).length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {(photos ?? []).map(
            (p) =>
              p.signedUrl && (
                // Signed, short-lived URLs from private storage: not worth the optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.path}
                  src={p.signedUrl}
                  alt="The car"
                  className="h-28 w-40 shrink-0 rounded-lg object-cover"
                />
              ),
          )}
        </div>
      )}
      {carPrivate && (
        <p className="text-sm">
          Number plate{" "}
          <span className="rounded bg-white px-2 py-0.5 font-mono font-semibold tracking-wider text-neutral-900">
            {carPrivate.plate}
          </span>
        </p>
      )}

      {contact?.phone && (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={callLink(contact.phone)}
            className="flex h-12 items-center justify-center rounded-xl border border-emerald-400 bg-white font-medium text-emerald-900 dark:border-emerald-700 dark:bg-neutral-900 dark:text-emerald-200"
          >
            Call {firstName}
          </a>
          <a
            href={whatsappLink(
              contact.phone,
              `Hi ${firstName}, I have a seat in your car${pickup ? ` from ${pickup.label} at ${pickup.time}` : ""}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center rounded-xl bg-[#25D366] font-medium text-white"
          >
            WhatsApp
          </a>
        </div>
      )}
      {contact?.upi_vpa && (
        <a
          href={upiLink({ vpa: contact.upi_vpa, name: contact.name, amount })}
          className="flex h-12 items-center justify-center rounded-xl bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Pay ₹{amount} by UPI after the ride
        </a>
      )}
    </section>
  );
}

// After the ride: thanks, and Pay by UPI if not done yet. The owner's contact stays available
// for a day after the ride for exactly this.
async function Completed({
  ride,
  seats,
  ownerFirstName,
}: {
  ride: RideRow;
  seats: number;
  ownerFirstName: string;
}) {
  const supabase = await createClient();
  const { data: contact } = await supabase
    .rpc("get_contact", { p_user_id: ride.owner_id })
    .maybeSingle();
  const amount = ride.price_per_seat * seats;
  return (
    <Status title={`You rode with ${ownerFirstName}`} tone="good">
      +2 reliability points.{" "}
      {contact?.upi_vpa ? (
        <a
          href={upiLink({ vpa: contact.upi_vpa, name: contact.name, amount })}
          className="font-medium underline"
        >
          Pay ₹{amount} by UPI
        </a>
      ) : (
        `Settle the ₹${amount} with ${ownerFirstName} directly.`
      )}
    </Status>
  );
}

function Status({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "neutral" | "good" | "bad";
  children: React.ReactNode;
}) {
  const colours = {
    neutral:
      "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900",
    good: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
    bad: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
  }[tone];
  return (
    <section className={`space-y-1 rounded-2xl border p-4 ${colours}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm">{children}</p>
    </section>
  );
}
