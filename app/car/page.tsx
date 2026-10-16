import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CarForm, type CarPhoto } from "./car-form";

export const metadata: Metadata = { title: "Your car · CorporatePool" };

export default function CarPage() {
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
          <CarSection />
        </Suspense>
      </main>
    </>
  );
}

// The car's one-time setup (F-A3, user flow 2). v1 handles one car per owner.
async function CarSection() {
  const user = await getCurrentUser();
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
    </div>
  );
}
