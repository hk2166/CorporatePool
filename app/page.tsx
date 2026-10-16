import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OwnerSection } from "@/app/go-live/owner-section";
import { ScoreChip } from "@/app/reliability/score-chip";
import { MySeats } from "@/app/rides/my-seats";
import { FindSeatCard } from "@/app/search/find-seat-card";
import { AppHeader } from "@/components/app-header";
import { InstallPrompt } from "@/components/install-prompt";
import { PushToggle } from "@/components/push-toggle";
import { getCurrentUser } from "@/lib/auth";
import { homeSections } from "@/lib/ride-preference";

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 lg:max-w-5xl">
        {/* Who's signed in is only known per request, so that part streams in. */}
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
              <div className="h-48 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            </div>
          }
        >
          <SignedInHome />
        </Suspense>
      </main>
    </>
  );
}

async function SignedInHome() {
  const user = await getCurrentUser();
  // Asked once, before anything else: riding, driving or both (/welcome).
  if (user.ridePreference === null) redirect("/welcome");
  const firstName = user.name.split(" ")[0];
  const [first, second] = homeSections(user.ridePreference);
  const sections = {
    riding: (
      <>
        <MySeats userId={user.id} />
        <FindSeatCard />
      </>
    ),
    driving: <OwnerSection userId={user.id} />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi, {firstName}
        </h1>
        <ScoreChip userId={user.id} />
      </div>
      {!user.hasPhone && (
        <Link
          href="/profile"
          className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          Add your mobile number so you can book or offer rides.{" "}
          <span className="font-medium underline">Go to your profile</span>
        </Link>
      )}
      {/* What they said they use the app for comes first: on a phone at the top, on a laptop
          in the left column. Riders don't get the driving section at all. */}
      <div
        className={
          second
            ? "space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8 lg:space-y-0"
            : "space-y-6 lg:mx-auto lg:max-w-2xl"
        }
      >
        <div className="space-y-6">
          {sections[first]}
          <PushToggle compact />
          <InstallPrompt />
          <Link
            href="/feedback"
            className="block rounded-xl border border-neutral-300 px-4 py-3 text-sm dark:border-neutral-700"
          >
            <span className="font-medium">Ideas or problems?</span> Send
            feedback and upvote what you want next.
          </Link>
          {user.isAdmin && (
            <Link
              href="/admin/dashboard"
              className="block rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium dark:border-neutral-700"
            >
              Admin dashboard: users, rides, join requests, feedback and more
            </Link>
          )}
          {user.ridePreference === "RIDER" && (
            <p className="text-sm text-neutral-500">
              Drive to work too?{" "}
              <Link href="/profile#preference" className="underline">
                Offer your seats as well
              </Link>
            </p>
          )}
        </div>
        {second && <div className="space-y-6">{sections[second]}</div>}
      </div>
    </div>
  );
}
