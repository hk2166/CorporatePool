import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { LiveSeatsLeft, LiveSeatsProvider } from "@/components/live-seats";
import { ShareRideButton } from "@/components/share-ride-button";
import { getCurrentUser } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { getPublicRide } from "@/lib/public-ride";
import { shareMessage } from "@/lib/ride-card";
import { createClient } from "@/lib/supabase/server";
import { OwnerRiders } from "./owner-riders";
import { CancelRide, RideNotes } from "./ride-controls";
import { RiderView } from "./rider-view";

export const metadata: Metadata = { title: "Ride · CorporatePool" };

export default function RidePage({
  params,
  searchParams,
}: PageProps<"/rides/[id]">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 lg:max-w-7xl lg:px-8">
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One ride. The owner sees route, seats, who has booked, notes and cancel; anyone else sees
// the rider's view.
async function RideDetails({
  params,
  searchParams,
}: {
  params: PageProps<"/rides/[id]">["params"];
  searchParams: PageProps<"/rides/[id]">["searchParams"];
}) {
  const [{ id }, { live, pickup, drop }] = await Promise.all([
    params,
    searchParams,
  ]);
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: ride } = UUID.test(id)
    ? await supabase
        .from("rides")
        .select(
          "id, owner_id, car_id, depart_at, allocation_at, seats_total, seats_left, price_per_seat, notes, status, women_only",
        )
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  if (!ride) notFound();
  // Riders get their own view: request a seat, see where they stand.
  if (ride.owner_id !== user.id) {
    return (
      <RiderView
        ride={ride}
        userId={user.id}
        pickup={typeof pickup === "string" ? Number(pickup) : undefined}
        drop={typeof drop === "string" ? Number(drop) : undefined}
      />
    );
  }

  const [{ data: stops }, { data: bookings }] = await Promise.all([
    supabase
      .from("ride_stops")
      .select("seq, label, eta_offset_min")
      .eq("ride_id", ride.id)
      .order("seq"),
    supabase
      .from("bookings")
      .select(
        "id, rider_id, status, seats, waitlist_rank, pickup_seq, picked_up_at, rider:users!bookings_rider_id_fkey(name)",
      )
      .eq("ride_id", ride.id)
      .in("status", [
        "REQUESTED",
        "CONFIRMED",
        "WAITLISTED",
        "NO_SHOW",
        "COMPLETED",
      ])
      .order("waitlist_rank", { nullsFirst: true })
      .order("created_at"),
  ]);

  const day = indiaDate(new Date(ride.depart_at));
  const open = ["OPEN", "ALLOCATING", "FULL"].includes(ride.status);
  // The same card the WhatsApp link shows, for the share message.
  const publicRide = open ? await getPublicRide(ride.id) : null;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/r/${ride.id}`;

  // Seats and the rider list update by themselves while the owner watches (F-C3).
  return (
    <LiveSeatsProvider rideIds={[ride.id]} refresh={open}>
      {/* On a laptop: the ride on the left; its riders and what to do on the right. */}
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:space-y-0">
        <div className="space-y-6">
          {live === "1" && open && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            >
              Your ride is posted. Share it in your WhatsApp group so people can
              book.
            </p>
          )}
          <div className="space-y-1">
            <p className="text-sm text-neutral-500">{dayLabel(day)}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {indiaTime(ride.depart_at)} ·{" "}
              <LiveSeatsLeft
                rideId={ride.id}
                seatsLeft={ride.seats_left}
                status={ride.status}
                total={ride.seats_total}
              />
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
        </div>

        <div className="space-y-6">
          <OwnerRiders
            ride={ride}
            bookings={bookings ?? []}
            stops={stops ?? []}
          />

          {publicRide && (
            <ShareRideButton
              message={shareMessage(publicRide, url)}
              url={url}
            />
          )}

          {open && (
            <>
              <RideNotes rideId={ride.id} notes={ride.notes ?? ""} />
              <CancelRide
                rideId={ride.id}
                riders={
                  (bookings ?? []).filter((b) =>
                    ["REQUESTED", "CONFIRMED", "WAITLISTED"].includes(b.status),
                  ).length
                }
              />
            </>
          )}
        </div>
      </div>
    </LiveSeatsProvider>
  );
}
