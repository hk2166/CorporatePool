import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { formatCoordinates } from "@/lib/coordinates";
import { createClient } from "@/lib/supabase/server";
import { DeleteStopForm, MergeForm, StopForm } from "./stop-forms";

export const metadata: Metadata = { title: "Stops · Admin · CorporatePool" };

export default function StopsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 lg:max-w-5xl space-y-6 px-4 py-6">
        <AdminNav current="/admin/stops" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Stops />
        </Suspense>
      </main>
    </>
  );
}

// The stop list everyone picks from (F-G6, Q2): add, change, merge duplicates, delete.
async function Stops() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const { data: stops } = await supabase.rpc("list_places");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Stops <span className="text-neutral-500">({stops?.length ?? 0})</span>
        </h1>
        <p className="text-sm text-neutral-500">
          Landmarks riders and owners pick from, south to north. In Google Maps,
          press and hold a spot to copy its coordinates.
        </p>
        <StopForm submitLabel="Add" />
      </section>

      {(stops ?? []).length > 1 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Merge a duplicate</h2>
          <p className="text-sm text-neutral-500">
            Everyone and every ride using the duplicate moves to the stop you
            keep, and the duplicate is deleted.
          </p>
          <MergeForm
            stops={(stops ?? []).map((s) => ({ id: s.id, name: s.name }))}
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">All stops</h2>
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {(stops ?? []).map((s) => (
            <li key={s.id}>
              <details className="px-4 py-3">
                <summary className="flex cursor-pointer justify-between gap-3">
                  <span>{s.name}</span>
                  <span className="text-sm text-neutral-500">{s.kind}</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <StopForm
                    id={s.id}
                    name={s.name}
                    kind={s.kind}
                    coordinates={formatCoordinates(s.lat, s.lng)}
                    submitLabel="Save"
                  />
                  <DeleteStopForm id={s.id} name={s.name} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
