import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { StopInput } from "@/lib/usual-ride";
import { UsualRideForm } from "./usual-ride-form";

export const metadata: Metadata = { title: "Your usual ride · CorporatePool" };

export default function UsualRidePage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-56 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <UsualRideSection />
        </Suspense>
      </main>
    </>
  );
}

type StoredStop = { place_id?: string; eta_offset_min?: number };

// The owner's usual ride, saved once (F-B1, user flow 2 step 3).
async function UsualRideSection() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [{ data: car }, { data: places }, { data: usual }, { data: me }] =
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
          "id, depart_time, seats_offered, price_per_seat, notes, auto_golive_days, stops",
        )
        .eq("owner_id", user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("get_my_profile").maybeSingle(),
    ]);

  if (!car) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your usual ride
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Add your car first, then set up the ride you usually offer.
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

  // A new usual ride starts from the owner's home and office stops, if they set them.
  const stops: StopInput[] | undefined = usual
    ? (usual.stops as StoredStop[]).map((stop) => ({
        placeId: stop.place_id ?? "",
        etaOffsetMin: stop.eta_offset_min ?? 0,
      }))
    : me?.home_place_id && me?.work_place_id
      ? [
          { placeId: me.home_place_id, etaOffsetMin: 0 },
          { placeId: me.work_place_id, etaOffsetMin: 60 },
        ]
      : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your usual ride
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Save it once. Each evening, going live for the next day is one tap.
        </p>
      </div>
      <UsualRideForm
        places={(places ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
        }))}
        car={{ id: car.id, seats: car.seats_total }}
        usualRide={
          usual || stops
            ? {
                id: usual?.id ?? "",
                departTime: usual?.depart_time.slice(0, 5) ?? "08:00",
                seats: usual?.seats_offered ?? Math.min(3, car.seats_total),
                price: usual?.price_per_seat ?? 0,
                notes: usual?.notes ?? "",
                autoDays: usual?.auto_golive_days ?? 0,
                stops: stops ?? [],
              }
            : null
        }
      />
    </div>
  );
}
