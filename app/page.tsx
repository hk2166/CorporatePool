import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
        {/* Who's signed in is only known per request, so that part streams in. */}
        <Suspense
          fallback={
            <div className="h-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Greeting />
        </Suspense>
        <p className="text-neutral-600 dark:text-neutral-400">
          Finding and offering rides is coming next.
        </p>
      </main>
    </>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {firstName}</h1>
      {!user.hasPhone && (
        <Link
          href="/profile"
          className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          Add your mobile number so you can book or offer rides.{" "}
          <span className="font-medium underline">Go to your profile</span>
        </Link>
      )}
    </div>
  );
}
