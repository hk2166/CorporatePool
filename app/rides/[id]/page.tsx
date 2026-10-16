import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { ShareRideButton } from "@/components/share-ride-button";
import { getCurrentUser } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { getPublicRide } from "@/lib/public-ride";
import { shareMessage } from "@/lib/ride-card";
import { createClient } from "@/lib/supabase/server";
import { CancelRide, RideNotes } from "./ride-controls";

export const metadata: Metadata = { title: "Your ride · CorporatePool" };

export default function RidePage({
  params,
  searchParams,
}: PageProps<"/rides/[id]">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <RideDetails params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  WAITLISTED: "waitlisted",
};

// The owner's view of one of their rides: route, seats, who has booked, notes and cancel.
async function RideDetails({
  params,
  searchParams,
}: {
  params: PageProps<"/rides/[id]">["params"];
  searchParams: PageProps<"/rides/[id]">["searchParams"];
}) {
  const [{ id }, { live }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: ride } = await supabase
    .from("rides")
    .select(
      "id, owner_id, depart_at, seats_total, seats_left, price_per_seat, notes, status",
    )
    .eq("id", id)
    .maybeSingle();
  // Only the owner manages a ride here; riders get their own view later.
  if (!ride || ride.owner_id !== user.id) notFound();

  const [{ data: stops }, { data: bookings }] = await Promise.all([
    supabase
      .from("ride_stops")
      .select("seq, label, eta_offset_min")
      .eq("ride_id", ride.id)
      .order("seq"),
    supabase
      .from("bookings")
      .select("id, status, seats, rider:users!bookings_rider_id_fkey(name)")
      .eq("ride_id", ride.id)
      .in("status", ["REQUESTED", "CONFIRMED", "WAITLISTED"])
      .order("created_at"),
  ]);

  const day = indiaDate(new Date(ride.depart_at));
  const open = ["OPEN", "ALLOCATING", "FULL"].includes(ride.status);
  // The same card the WhatsApp link shows, for the share message.
  const publicRide = open ? await getPublicRide(ride.id) : null;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/r/${ride.id}`;

  return (
    <div className="space-y-6">
      {live === "1" && open && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          You&apos;re live. Share it in your WhatsApp group so riders can book.
        </p>
      )}
      <div className="space-y-1">
        <p className="text-sm text-neutral-500">{dayLabel(day)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {indiaTime(ride.depart_at)} ·{" "}
          {ride.status === "CANCELLED"
            ? "Cancelled"
            : ride.seats_left === 0
              ? "Full"
              : `${ride.seats_left} of ${ride.seats_total} seats free`}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          ₹{ride.price_per_seat} a seat
        </p>
      </div>

      <ol className="space-y-1">
        {(stops ?? []).map((stop) => (
          <li key={stop.seq} className="flex justify-between gap-3">
            <span>{stop.label}</span>
            <span className="text-sm text-neutral-500">
              {stop.seq === 0 ? "sets off" : `+${stop.eta_offset_min} min`}
            </span>
          </li>
        ))}
      </ol>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-500">Riders</h2>
        {bookings && bookings.length > 0 ? (
          <ul className="space-y-1">
            {bookings.map((booking) => (
              <li key={booking.id} className="flex justify-between">
                <span>{booking.rider?.name ?? "A rider"}</span>
                <span className="text-sm text-neutral-500">
                  {booking.seats > 1 ? `${booking.seats} seats, ` : ""}
                  {STATUS_LABEL[booking.status] ?? booking.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">No bookings yet.</p>
        )}
      </section>

      {publicRide && (
        <ShareRideButton message={shareMessage(publicRide, url)} url={url} />
      )}

      {open && (
        <>
          <RideNotes rideId={ride.id} notes={ride.notes ?? ""} />
          <CancelRide rideId={ride.id} riders={bookings?.length ?? 0} />
        </>
      )}
    </div>
  );
}
