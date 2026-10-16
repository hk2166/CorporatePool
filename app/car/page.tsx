import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CarForm, type CarPhoto } from "./car-form";

export const metadata: Metadata = { title: "Your car · CorporatePool" };

export default function CarPage({ searchParams }: PageProps<"/car">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 md:max-w-xl px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-80 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <CarSection searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

// The car's one-time setup (F-A3, user flow 2). v1 handles one car per owner. Part of sign-up
// for drivers (?welcome=1): after it come their morning and evening rides.
async function CarSection({
  searchParams,
}: {
  searchParams: PageProps<"/car">["searchParams"];
}) {
  const [{ welcome }, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);
  const isWelcome = welcome === "1";
  const supabase = await createClient();

  const { data: car } = await supabase
    .from("cars")
    .select("id, model, colour, seats_total")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let details: {
    id: string;
    model: string;
    colour: string;
    plate: string;
    seats: number;
    photos: CarPhoto[];
  } | null = null;

  if (car) {
    // Plate and photos are private columns: read through the function that checks access.
    const { data: privateDetails } = await supabase
      .rpc("get_car_private", { p_car_id: car.id })
      .maybeSingle();
    const paths = privateDetails?.photo_paths ?? [];
    // Short-lived links to the private photos; Storage only makes them for allowed viewers.
    const { data: signed } = paths.length
      ? await supabase.storage.from("car-photos").createSignedUrls(paths, 3600)
      : { data: [] };
    details = {
      id: car.id,
      model: car.model,
      colour: car.colour,
      plate: privateDetails?.plate ?? "",
      seats: car.seats_total,
      // Keep only links that were actually made; narrowing here also tells TypeScript.
      photos: (signed ?? []).flatMap((s) =>
        s.signedUrl && s.path ? [{ path: s.path, url: s.signedUrl }] : [],
      ),
    };
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {details ? "Your car" : "Add your car"}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {details
            ? "Changes apply to rides you post from now on."
            : "Set it up once. After that, offering a ride is one tap."}
        </p>
      </div>
      <CarForm userId={user.id} car={details} />
      {isWelcome && (
        <div className="space-y-2">
          {details && (
            <Link
              href="/usual-ride?welcome=1"
              className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white"
            >
              Next: your morning and evening rides
            </Link>
          )}
          <Link
            href="/"
            className="flex min-h-10 items-center justify-center text-sm text-neutral-500 underline"
          >
            Skip for now
          </Link>
        </div>
      )}
    </div>
  );
}
