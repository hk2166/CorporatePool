import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BlockedList } from "@/app/report/blocked-list";
import { PushToggle } from "@/components/push-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { DeleteAccount } from "./delete-account";
import { RidePreferencePicker } from "@/app/welcome/ride-preference-picker";
import { isCarOwner, parseRidePreference } from "@/lib/ride-preference";
import { parseRideAlerts } from "@/lib/ride-alerts";
import { DIRECTIONS, parseDirection } from "@/lib/usual-ride";
import { ProfileForm } from "./profile-form";
import { RideAlertsPicker } from "./ride-alerts-picker";

export const metadata: Metadata = { title: "Profile · CorporatePool" };

export default function ProfilePage({ searchParams }: PageProps<"/profile">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 md:max-w-xl px-4 py-6">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-64 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <ProfileSection searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function ProfileSection({
  searchParams,
}: {
  searchParams: PageProps<"/profile">["searchParams"];
}) {
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";
  const user = await getCurrentUser();

  const supabase = await createClient();
  const [{ data: profile }, { data: places }, { data: usuals }] =
    await Promise.all([
      supabase.rpc("get_my_profile").single(),
      // In route order (south to north), like the corridor itself.
      supabase.rpc("list_places"),
      // A car owner's rides, with what they charge (shown under "Do you have a car to share?").
      supabase
        .from("usual_rides")
        .select("id, direction, depart_time, price_per_seat, stops")
        .eq("owner_id", user.id),
    ]);
  if (!profile) return null;
  const owner = isCarOwner(parseRidePreference(profile.ride_preference));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isWelcome ? "Welcome! One more step" : "Your profile"}
        </h1>
        {isWelcome && (
          <p className="text-neutral-600 dark:text-neutral-400">
            Add your mobile number so the person you ride with can reach you (it
            stays hidden until a seat is confirmed), and tell us where home and
            the office are.
          </p>
        )}
      </div>
      <ProfileForm
        welcome={isWelcome}
        isOwner={owner}
        places={(places ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
        }))}
        profile={{
          name: profile.name,
          phone: profile.phone,
          upiId: profile.upi_vpa,
          homePlaceId: profile.home_place_id,
          workPlaceId: profile.work_place_id,
        }}
      />
      {!isWelcome && (
        <>
          <section id="preference" className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Do you have a car to share?
              </h2>
              <p className="text-sm text-neutral-500">
                Car owners get Offer and Car in the menu: list your car, then
                your morning and evening rides with your price. Riders just find
                seats.
              </p>
            </div>
            <RidePreferencePicker
              current={parseRidePreference(profile.ride_preference)}
            />
            {owner && (
              <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <h3 className="text-sm font-medium">Your rides and prices</h3>
                <ul className="space-y-1 text-sm">
                  {DIRECTIONS.map((d) => {
                    const usual = (usuals ?? []).find(
                      (u) => parseDirection(u.direction) === d.value,
                    );
                    const stops = (usual?.stops ?? []) as { label?: string }[];
                    return (
                      <li
                        key={d.value}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="font-medium capitalize">
                            {d.word}
                          </span>{" "}
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {usual
                              ? `${stops[0]?.label ?? "Start"} → ${stops.at(-1)?.label ?? "End"}, ${usual.depart_time.slice(0, 5)}`
                              : "not set up yet"}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {usual ? `₹${usual.price_per_seat} a seat` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-x-4 text-sm">
                  <Link
                    href="/usual-ride"
                    className="inline-flex min-h-10 items-center underline"
                  >
                    Change routes or prices
                  </Link>
                  <Link
                    href="/car"
                    className="inline-flex min-h-10 items-center underline"
                  >
                    Your car
                  </Link>
                </div>
              </div>
            )}
          </section>
          <section id="alerts" className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Ride alerts</h2>
              <p className="text-sm text-neutral-500">
                Hear about cars going your way, like in the WhatsApp group: to
                the office in the morning and home in the evening, matched to
                your home and office stops above.
              </p>
            </div>
            {!(profile.home_place_id && profile.work_place_id) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Set your home and office above first: alerts are matched to
                them.
              </p>
            )}
            <RideAlertsPicker current={parseRideAlerts(profile.ride_alerts)} />
            <PushToggle />
          </section>
          <BlockedList />
          <SignOutButton />
          <DeleteAccount />
        </>
      )}
    </div>
  );
}
