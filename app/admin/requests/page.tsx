import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { DecisionButtons } from "./decision-buttons";

export const metadata: Metadata = {
  title: "Join requests · Admin · CorporatePool",
};

export default function RequestsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 lg:max-w-7xl lg:px-8 space-y-6 px-4 py-6">
        <AdminNav current="/admin/requests" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Requests />
        </Suspense>
      </main>
    </>
  );
}

function when(at: string): string {
  return `${dayLabel(indiaDate(new Date(at)))} ${indiaTime(at)}`;
}

// People who signed in without an invite and asked to join: accept or reject, oldest first.
// Below, the recent decisions, where a rejection can still be undone.
async function Requests() {
  await getCurrentAdmin();
  const supabase = await createClient();
  // The access rules let admins read every request.
  const [{ data: pending, error }, { data: decided }] = await Promise.all([
    supabase
      .from("join_requests")
      .select("user_id, name, email, note, created_at")
      .eq("status", "PENDING")
      .order("created_at"),
    supabase
      .from("join_requests")
      .select(
        "user_id, name, email, status, decided_at, by:users!join_requests_decided_by_fkey(name)",
      )
      .neq("status", "PENDING")
      .order("decided_at", { ascending: false })
      .limit(20),
  ]);
  if (error) return <p role="alert">Couldn&apos;t load the requests.</p>;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Join requests{" "}
          <span className="text-neutral-500">({pending.length} waiting)</span>
        </h1>
        <p className="text-sm text-neutral-500">
          People who signed in without an invite link and asked to join.
          Accepting makes them a member; they&apos;re in the next time they open
          the app.
        </p>
        {pending.length === 0 && (
          <p className="text-sm text-neutral-500">Nobody is waiting.</p>
        )}
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {pending.map((r) => (
            <li
              key={r.user_id}
              className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="space-y-1">
                <p className="font-medium">{r.name}</p>
                <p className="text-sm break-words text-neutral-600 dark:text-neutral-400">
                  {r.email ?? "No email"} · asked {when(r.created_at)}
                </p>
                {r.note && (
                  <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm whitespace-pre-line dark:bg-neutral-900">
                    {r.note}
                  </p>
                )}
              </div>
              <DecisionButtons userId={r.user_id} name={r.name} />
            </li>
          ))}
        </ul>
      </section>

      {(decided ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Recently decided</h2>
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {(decided ?? []).map((r) => (
              <li key={r.user_id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    {r.status === "ACCEPTED" ? (
                      <Link
                        href={`/admin/members/${r.user_id}`}
                        className="font-medium underline"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.name}</span>
                    )}{" "}
                    <span className="text-neutral-500">{r.email}</span>
                  </span>
                  <span
                    className={`whitespace-nowrap ${r.status === "ACCEPTED" ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-500"}`}
                  >
                    {r.status === "ACCEPTED" ? "Accepted" : "Rejected"}
                  </span>
                </div>
                <p className="text-neutral-500">
                  {r.by?.name ?? "An admin"}
                  {r.decided_at && `, ${when(r.decided_at)}`}
                </p>
                {r.status === "REJECTED" && (
                  <DecisionButtons
                    userId={r.user_id}
                    name={r.name}
                    canReject={false}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
