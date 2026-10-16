import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";
import { AddStopForm } from "./add-stop-form";

export const metadata: Metadata = { title: "Add a stop · CorporatePool" };

// Add a stop to the shared list: where you get in or out, or a stop on your route. If one with
// that name, or one within 150 m, is already there, that one is used instead.
export default function AddStopPage({ searchParams }: PageProps<"/stops/new">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Add a stop</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Stops are shared: once added, everyone can pick it. Use a landmark,
            not your home address.
          </p>
        </div>
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
  const [{ next }] = await Promise.all([searchParams, getCurrentUser()]);
  return (
    <AddStopForm next={safeNextPath(typeof next === "string" ? next : null)} />
  );
}
