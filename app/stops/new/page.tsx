import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { AddStopForm } from "./add-stop-form";

export const metadata: Metadata = { title: "Request a stop · CorporatePool" };

// A stop that isn't in the list yet. Members ask an admin to add it; admins add it straight
// away (they can also do it, and handle requests, under Admin → Stops).
export default function AddStopPage({ searchParams }: PageProps<"/stops/new">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-6 md:max-w-xl">
        <Suspense
          fallback={
            <div className="h-72 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Form searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: PageProps<"/stops/new">["searchParams"];
}) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.isAdmin ? "Add a stop" : "Request a stop"}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {user.isAdmin
            ? "Stops are shared: once added, everyone can pick it. Use a landmark, not a home address."
            : "Tell us the stop's name and an admin will add it to the list for everyone. A Google Maps link helps them find the right spot. Use a landmark, not your home address."}
        </p>
      </div>
      <AddStopForm
        next={safeNextPath(typeof next === "string" ? next : null)}
        isAdmin={user.isAdmin}
      />
    </div>
  );
}
