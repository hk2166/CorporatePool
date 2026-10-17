import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { addDays, dayLabel, indiaDate } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Occupancy · Admin · CorporatePool",
};

export default function OccupancyPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 lg:max-w-7xl lg:px-8 space-y-6 px-4 py-6">
        <AdminNav current="/admin/occupancy" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Occupancy />
        </Suspense>
      </main>
    </>
  );
}

// Seats offered vs filled per day and route (F-G2): "no cab goes empty", measured. The last
// two weeks and tomorrow.
async function Occupancy() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const today = indiaDate();
  const { data: rows, error } = await supabase.rpc("admin_occupancy", {
    p_from: addDays(today, -14),
    p_to: addDays(today, 1),
  });
  if (error) return <p role="alert">Couldn&apos;t load occupancy.</p>;

  const offered = rows.reduce((n, r) => n + r.seats_offered, 0);
  const filled = rows.reduce((n, r) => n + r.seats_filled, 0);

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Occupancy</h1>
      <p className="text-sm text-neutral-500">
        Last 14 days and tomorrow: {filled} of {offered} seats filled
        {offered > 0 && ` (${Math.round((filled / offered) * 100)}%)`}.
        Cancelled rides aren&apos;t counted.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No rides yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 font-medium">Rides</th>
                <th className="px-3 py-2 font-medium">Filled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((r) => (
                <tr key={`${r.day}|${r.route}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {dayLabel(r.day)}
                  </td>
                  <td className="px-3 py-2">{r.route}</td>
                  <td className="px-3 py-2 tabular-nums">{r.rides}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {r.seats_filled} / {r.seats_offered}
                    <span className="ml-2 inline-block h-2 w-16 rounded-full bg-neutral-200 align-middle dark:bg-neutral-800">
                      <span
                        className="block h-2 rounded-full bg-emerald-500"
                        style={{
                          width: `${r.seats_offered ? Math.round((r.seats_filled / r.seats_offered) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
