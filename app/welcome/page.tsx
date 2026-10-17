import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { RidePreferencePicker } from "./ride-preference-picker";

export const metadata: Metadata = { title: "Welcome · CorporatePool" };

// The first thing a new member sees: are they looking for a ride, offering their seats, or
// both? The home page sends anyone who hasn't answered here, once. The answer can be changed
// on the profile page.
export default function WelcomePage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 md:max-w-xl lg:max-w-7xl lg:px-8">
        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Welcome />
        </Suspense>
      </main>
    </>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  const firstName = user.name.split(" ")[0];
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {firstName}!
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          How will you use CorporatePool? Your home page will show that first.
          You can change it any time on your profile.
        </p>
      </div>
      <RidePreferencePicker current={user.ridePreference} onboarding />
    </div>
  );
}
