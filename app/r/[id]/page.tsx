import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareRideButton } from "@/components/share-ride-button";
import { getPublicRide } from "@/lib/public-ride";
import {
  routeSummary,
  seatsSummary,
  shareMessage,
  whenSummary,
} from "@/lib/ride-card";

// The page behind a ride link shared in WhatsApp (F-H1). Open to everyone, signed in or not;
// it shows only what get_public_ride() exposes.

export async function generateMetadata({
  params,
}: PageProps<"/r/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ride = await getPublicRide(id);
  if (!ride) return { title: "Ride not found · CorporatePool" };

  const title = `${routeSummary(ride.stops)} · ${whenSummary(ride.depart_at)}`;
  const description = `${seatsSummary(ride)} · ₹${ride.price_per_seat} a seat · with ${ride.owner_first_name} on CorporatePool`;
  // The preview image comes from ./opengraph-image.tsx, which Next.js adds automatically.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "CorporatePool",
      type: "website",
    },
  };
}

export default function PublicRidePage({ params }: PageProps<"/r/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center self-start font-semibold tracking-tight"
      >
        CorporatePool
      </Link>
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        }
      >
        <RideCard params={params} />
      </Suspense>
    </main>
  );
}

async function RideCard({
  params,
}: {
  params: PageProps<"/r/[id]">["params"];
}) {
  const { id } = await params;
  const ride = await getPublicRide(id);
  if (!ride) notFound();

  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/r/${ride.ride_id}`;
  const seats = seatsSummary(ride);
  const bookable =
    ["OPEN", "ALLOCATING"].includes(ride.status) && ride.seats_left > 0;
  const stops = [...ride.stops].sort((a, b) => a.seq - b.seq);

  return (
    <article className="space-y-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <header className="space-y-1">
        <p className="text-sm text-neutral-500">
          {whenSummary(ride.depart_at)} · with {ride.owner_first_name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {routeSummary(ride.stops)}
        </h1>
        <p className="text-lg">
          <span
            className={bookable ? "text-emerald-700 dark:text-emerald-400" : ""}
          >
            {seats === "Full" ||
            seats === "Cancelled" ||
            seats === "Already left"
              ? seats
              : `${seats} free`}
          </span>{" "}
          · ₹{ride.price_per_seat} a seat
        </p>
        {ride.women_only && (
          <p className="inline-block rounded-full bg-pink-100 px-3 py-1 text-sm text-pink-800 dark:bg-pink-950 dark:text-pink-300">
            Women only
          </p>
        )}
      </header>

      <ol className="space-y-2 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
        {stops.map((stop) => (
          <li key={stop.seq} className="flex justify-between gap-3">
            <span>{stop.label}</span>
            <span className="text-sm text-neutral-500">
              {stop.seq === 0 ? "sets off" : `+${stop.eta_offset_min} min`}
            </span>
          </li>
        ))}
      </ol>

      {bookable && (
        <Link
          // Signed in: straight to the ride. Not signed in: the proxy sends them to /login first
          // and back here after.
          href={`/rides/${ride.ride_id}`}
          className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white"
        >
          Request a seat
        </Link>
      )}

      <ShareRideButton
        message={shareMessage(ride, url)}
        url={url}
        label="Share"
      />

      <p className="text-xs text-neutral-500">
        Phone numbers and number plates are shared only once a seat is
        confirmed.
      </p>
    </article>
  );
}
