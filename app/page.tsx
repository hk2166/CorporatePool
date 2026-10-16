import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth";

export default function Home() {
  return (
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
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  const firstName = user.name.split(" ")[0];

  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Hi, {firstName}</h1>
      <SignOutButton />
    </header>
  );
}
