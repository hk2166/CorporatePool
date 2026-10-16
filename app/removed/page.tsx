import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Access removed · CorporatePool" };

// Where a member removed by an admin lands (T-7.2, F-G4). lib/auth.ts sends them here from
// every page; their sign-in is also banned, so they can't come back with a new session.
export default function RemovedPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your access was removed
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          An admin removed you from CorporatePool, and your rides and seats were
          cancelled. If you think this is a mistake, talk to your group admin.
        </p>
      </div>
      <SignOutButton />
    </main>
  );
}
