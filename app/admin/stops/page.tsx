import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { formatCoordinates } from "@/lib/coordinates";
import { createClient } from "@/lib/supabase/server";
import {
  DeleteStopForm,
  MergeForm,
  StopForm,
  StopRequestForm,
} from "./stop-forms";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";

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

// The stop list everyone picks from (F-G6, Q2): members' requests first, then add, change,
// merge duplicates, delete. Positions can be pasted as Google Maps links.
async function Stops() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const [{ data: stops }, { data: requests }] = await Promise.all([
    supabase.rpc("list_places"),
    // The access rules let admins read every request.
    supabase
      .from("stop_requests")
      .select(
        "id, name, lat, lng, maps_link, created_at, by:users!stop_requests_requested_by_fkey(id, name)",
      )
      .eq("status", "PENDING")
      .order("created_at"),
  ]);

  return (
    <div className="space-y-8">
      {(requests ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Requested by members ({requests?.length})
          </h2>
          <p className="text-sm text-neutral-500">
            Check the spot on the map, fix the name or position if needed, then
            add it or turn it down.
          </p>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {(requests ?? []).map((r) => {
              const map =
                r.maps_link ??
                (r.lat !== null && r.lng !== null
                  ? `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`
                  : null);
              return (
                <li
                  key={r.id}
                  className="space-y-3 rounded-2xl border border-amber-300 p-4 dark:border-amber-800"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-sm text-neutral-500">
                      {r.by?.name ?? "A member"} ·{" "}
                      {dayLabel(indiaDate(new Date(r.created_at)))}{" "}
                      {indiaTime(r.created_at)}
                      {r.lat === null && " · no position given"}
                    </p>
                    {map && (
                      <a
                        href={map}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center text-sm underline"
                      >
                        Open in Google Maps
                      </a>
                    )}
                  </div>
                  <StopRequestForm
                    requestId={r.id}
                    name={r.name}
                    coordinates={
                      r.lat !== null && r.lng !== null
                        ? formatCoordinates(r.lat, r.lng)
                        : (r.maps_link ?? "")
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Stops <span className="text-neutral-500">({stops?.length ?? 0})</span>
        </h1>
        <p className="text-sm text-neutral-500">
          Landmarks riders and owners pick from, south to north. To add one, in
          Google Maps, press and hold the spot to drop a pin, tap Share, then
          Copy link, and paste it here. Coordinates work too.
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
