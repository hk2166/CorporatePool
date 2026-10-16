import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rankings · Admin · CorporatePool" };

export default function RankingsPage({
  searchParams,
}: PageProps<"/admin/rankings">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <AdminNav current="/admin/rankings" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Rankings searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const COLUMNS = [
  { key: "name", label: "Member" },
  { key: "score", label: "Score" },
  { key: "rides", label: "Rides" },
  { key: "noshows", label: "No-shows (90 d)" },
  { key: "late", label: "Late cancels (90 d)" },
] as const;
type SortKey = (typeof COLUMNS)[number]["key"];

// Every member's reliability (F-G1), sortable by any column.
async function Rankings({
  searchParams,
}: {
  searchParams: PageProps<"/admin/rankings">["searchParams"];
}) {
  const [{ sort }] = await Promise.all([searchParams, getCurrentAdmin()]);
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("admin_rankings");
  if (error) {
    return <p role="alert">Couldn&apos;t load the rankings.</p>;
  }

  const key: SortKey = COLUMNS.some((c) => c.key === sort)
    ? (sort as SortKey)
    : "score";
  const sorted = [...rows].sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name);
      case "rides":
        return b.rides_completed - a.rides_completed;
      case "noshows":
        return b.no_shows_90d - a.no_shows_90d;
      case "late":
        return b.late_cancels_90d - a.late_cancels_90d;
      default:
        return b.reliability_score - a.reliability_score;
    }
  });

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Rankings</h1>
      <p className="text-sm text-neutral-500">
        {rows.length} members. When seats are short, higher scores get them
        first.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 font-medium whitespace-nowrap"
                >
                  <Link
                    href={`/admin/rankings?sort=${c.key}`}
                    className={`inline-flex min-h-9 items-center ${key === c.key ? "underline" : ""}`}
                  >
                    {c.label}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sorted.map((r) => (
              <tr key={r.user_id}>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {r.reliability_score}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.rides_completed}</td>
                <td
                  className={`px-3 py-2 tabular-nums ${r.no_shows_90d ? "text-red-600 dark:text-red-400" : ""}`}
                >
                  {r.no_shows_90d}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.late_cancels_90d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
