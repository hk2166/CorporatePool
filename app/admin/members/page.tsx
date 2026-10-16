import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { lastSeen, MEMBER_SORTS, memberSort, sortMembers } from "@/lib/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { indiaDate } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Members · Admin · CorporatePool" };

export default function MembersPage({
  searchParams,
}: PageProps<"/admin/members">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 lg:max-w-5xl space-y-6 px-4 py-6">
        <AdminNav current="/admin/members" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Members searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

// Everyone in the group, searchable by name, email or phone, and ranked by activity, rides
// offered, rides taken or reliability. Each links to everything about that member.
async function Members({
  searchParams,
}: {
  searchParams: PageProps<"/admin/members">["searchParams"];
}) {
  const [params] = await Promise.all([searchParams, getCurrentAdmin()]);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const sort = memberSort(params.sort);
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("admin_members", {
    p_query: q || undefined,
  });
  if (error) return <p role="alert">Couldn&apos;t load the members.</p>;

  const today = indiaDate();
  const sorted = sortMembers(rows, sort);
  const query = (s: string) =>
    `/admin/members?${new URLSearchParams({ ...(q && { q }), sort: s })}`;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Members <span className="text-neutral-500">({rows.length})</span>
      </h1>
      <form action="/admin/members" className="flex gap-2">
        <input type="hidden" name="sort" value={sort} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name, email or phone"
          aria-label="Search members"
          className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 dark:border-neutral-700"
        />
        <button
          type="submit"
          className="h-11 rounded-xl bg-neutral-900 px-4 font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Search
        </button>
      </form>
      <nav aria-label="Order" className="-mx-4 flex gap-1 overflow-x-auto px-4">
        {MEMBER_SORTS.map((s) => (
          <Link
            key={s.key}
            href={query(s.key)}
            aria-current={s.key === sort ? "true" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm whitespace-nowrap ${
              s.key === sort
                ? "border-neutral-900 font-medium dark:border-white"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {sorted.length === 0 && (
        <p className="text-sm text-neutral-500">
          {q ? `Nobody matches “${q}”.` : "No members yet."}
        </p>
      )}
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {sorted.map((m, i) => (
          <li key={m.user_id}>
            <Link
              href={`/admin/members/${m.user_id}`}
              className={`block space-y-1 rounded-2xl border border-neutral-200 px-4 py-3 transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900 ${m.removed_at ? "opacity-60" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">
                  {sort !== "joined" && sort !== "name" && (
                    <span className="mr-2 text-neutral-500 tabular-nums">
                      {i + 1}.
                    </span>
                  )}
                  {m.name}
                  {m.is_admin && <Badge>Admin</Badge>}
                  {m.removed_at && <Badge>Removed</Badge>}
                </p>
                <p className="text-sm whitespace-nowrap text-neutral-500">
                  {lastSeen(m.last_active, today)}
                </p>
              </div>
              <p className="truncate text-sm text-neutral-600 dark:text-neutral-400">
                {[m.email, m.phone ?? "no phone yet"]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {m.home && m.work ? `${m.home} → ${m.work}` : "Commute not set"}
              </p>
              <p className="text-xs text-neutral-500 tabular-nums">
                Score {m.reliability_score} · offered {m.rides_offered} · took{" "}
                {m.rides_taken} · in the app {m.active_days_30} of the last 30
                days
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 align-middle text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {children}
    </span>
  );
}
