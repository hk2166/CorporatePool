import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import {
  closeReport,
  removeMember,
  restoreMember,
  setRideHidden,
} from "./actions";
import { ModerationForm } from "./moderation-form";

export const metadata: Metadata = { title: "Reports · Admin · CorporatePool" };

export default function ReportsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <AdminNav current="/admin/reports" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Moderation />
        </Suspense>
      </main>
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  REMOVE_USER: "Removed",
  RESTORE_USER: "Restored",
  HIDE_RIDE: "Hid a ride",
  UNHIDE_RIDE: "Unhid a ride",
  RESOLVE_REPORT: "Resolved a report",
  DISMISS_REPORT: "Dismissed a report",
};

function when(at: string): string {
  return `${dayLabel(indiaDate(new Date(at)))} ${indiaTime(at)}`;
}

// The reports queue and what admins can do about it (F-G4): close reports, remove members,
// hide rides. Everything lands in the audit trail at the bottom.
async function Moderation() {
  await getCurrentAdmin();
  const supabase = await createClient();
  const [
    { data: open },
    { data: closed },
    { data: removed },
    { data: hidden },
    { data: trail },
  ] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, reason, created_at, ride_id, by:users!reports_by_user_fkey(name), about:users!reports_about_user_fkey(id, name)",
      )
      .eq("status", "OPEN")
      .order("created_at"),
    supabase
      .from("reports")
      .select(
        "id, reason, status, resolved_at, about:users!reports_about_user_fkey(name)",
      )
      .neq("status", "OPEN")
      .order("resolved_at", { ascending: false })
      .limit(10),
    supabase.rpc("admin_removed_users"),
    supabase
      .from("rides")
      .select("id, depart_at, hidden_at, owner:users!rides_owner_id_fkey(name)")
      .not("hidden_at", "is", null)
      .order("hidden_at", { ascending: false }),
    supabase
      .from("admin_actions")
      .select(
        "id, action, reason, created_at, admin:users!admin_actions_admin_id_fkey(name), target:users!admin_actions_target_user_fkey(name)",
      )
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reports{" "}
          <span className="text-neutral-500">({open?.length ?? 0} open)</span>
        </h1>
        {!open?.length && (
          <p className="text-sm text-neutral-500">Nothing to look at.</p>
        )}
        <ul className="space-y-3">
          {(open ?? []).map((r) => (
            <li
              key={r.id}
              className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="space-y-1">
                <p className="text-sm text-neutral-500">
                  {r.by?.name ?? "Someone"} about{" "}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {r.about?.name ?? "someone"}
                  </span>{" "}
                  · {when(r.created_at)}
                  {r.ride_id && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/rides/${r.ride_id}`} className="underline">
                        the ride
                      </Link>
                    </>
                  )}
                </p>
                <p>{r.reason}</p>
              </div>
              <ModerationForm
                action={closeReport}
                fields={{ reportId: r.id, outcome: "resolved" }}
                label="Resolve"
                placeholder="What you did"
              />
              <ModerationForm
                action={closeReport}
                fields={{ reportId: r.id, outcome: "dismissed" }}
                label="Dismiss"
                placeholder="Why no action"
              />
              {r.ride_id && (
                <ModerationForm
                  action={setRideHidden}
                  fields={{ rideId: r.ride_id, hidden: "true" }}
                  label="Hide the ride"
                  placeholder="Why hide it"
                />
              )}
              {r.about && (
                <ModerationForm
                  action={removeMember}
                  fields={{ userId: r.about.id }}
                  label={`Remove ${r.about.name.split(" ")[0]}`}
                  placeholder="Why remove them"
                  danger
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {(removed ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Removed members</h2>
          <ul className="space-y-3">
            {(removed ?? []).map((u) => (
              <li key={u.user_id} className="space-y-2">
                <p className="text-sm">
                  {u.name}{" "}
                  <span className="text-neutral-500">
                    · removed {when(u.removed_at)}
                  </span>
                </p>
                <ModerationForm
                  action={restoreMember}
                  fields={{ userId: u.user_id }}
                  label="Restore"
                  placeholder="Why restore them"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(hidden ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Hidden rides</h2>
          <ul className="space-y-3">
            {(hidden ?? []).map((ride) => (
              <li key={ride.id} className="space-y-2">
                <p className="text-sm">
                  <Link href={`/rides/${ride.id}`} className="underline">
                    {when(ride.depart_at)}
                  </Link>{" "}
                  by {ride.owner?.name ?? "someone"}
                </p>
                <ModerationForm
                  action={setRideHidden}
                  fields={{ rideId: ride.id, hidden: "false" }}
                  label="Unhide"
                  placeholder="Why unhide it"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(closed ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Recently closed</h2>
          <ul className="space-y-1 text-sm">
            {(closed ?? []).map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate">
                  {r.about?.name}: {r.reason}
                </span>
                <span className="shrink-0 text-neutral-500">
                  {r.status === "RESOLVED" ? "resolved" : "dismissed"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Audit trail</h2>
        {!trail?.length ? (
          <p className="text-sm text-neutral-500">No admin actions yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(trail ?? []).map((a) => (
              <li key={a.id}>
                <span className="text-neutral-500">{when(a.created_at)}</span>{" "}
                {a.admin?.name}: {ACTION_LABEL[a.action] ?? a.action}
                {a.target && ` ${a.target.name}`} · &ldquo;{a.reason}&rdquo;
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
