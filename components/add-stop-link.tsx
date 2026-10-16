"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Under every stop picker: a way to add a stop that isn't in the list yet (app/stops/new). When
// the list is empty it's a call to action, since nothing works until the first stops exist.
// After adding, it says the stop is now in the list.
export function AddStopLink({
  next,
  empty,
}: {
  // The page to come back to.
  next: string;
  empty: boolean;
}) {
  const added = useSearchParams().get("stopAdded");
  const href = `/stops/new?next=${encodeURIComponent(next)}`;

  if (empty) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <p>
          <span className="font-medium">No stops yet.</span> Add the places
          where people get in and out, like a bus stand, a metro station or an
          office gate.
        </p>
        <Link
          href={href}
          className="inline-flex h-10 items-center rounded-lg bg-amber-600 px-4 font-medium text-white"
        >
          Add the first stop
        </Link>
      </div>
    );
  }
  return (
    <p className="text-sm text-neutral-500">
      {added && (
        <span className="mr-1 font-medium text-emerald-700 dark:text-emerald-400">
          {added === "new"
            ? "Stop added: it's in the list now."
            : "That stop was already here: it's in the list."}
        </span>
      )}
      Stop not listed?{" "}
      <Link href={href} className="underline">
        Add a stop
      </Link>
    </p>
  );
}
