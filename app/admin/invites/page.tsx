import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { endInvite } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invites · Admin · CorporatePool" };

export default function InvitesPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <AdminNav current="/admin/invites" />
        <Suspense
          fallback={
            <div className="h-96 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          }
        >
          <Invites />
        </Suspense>
      </main>
    </>
  );
}

// Invite links (Q3: invite-only), replacing `npm run admin:invite`.
async function Invites() {
  await getCurrentAdmin();
  const supabase = await createClient();
  // The access rules let admins read invites.
  const { data: invites } = await supabase
    .from("signup_tokens")
    .select(
      "token, max_uses, used_count, expires_at, created_at, by:users!signup_tokens_created_by_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(20);
  const now = new Date().getTime();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
        <p className="text-sm text-neutral-500">
          CorporatePool is invite-only. Anyone who opens a link and signs in
          with Google joins, until its places run out or it expires.
        </p>
        <InviteForm />
      </section>

      {(invites ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Recent links</h2>
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {(invites ?? []).map((i) => {
              const expired = new Date(i.expires_at).getTime() <= now;
              const full = i.used_count >= i.max_uses;
              return (
                <li key={i.token} className="space-y-2 px-4 py-3 text-sm">
                  <p className="font-mono break-all text-neutral-600 dark:text-neutral-400">
                    {site}/invite/{i.token}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {i.used_count} of {i.max_uses} joined ·{" "}
                      {expired
                        ? "ended"
                        : full
                          ? "used up"
                          : `until ${dayLabel(indiaDate(new Date(i.expires_at)))} ${indiaTime(i.expires_at)}`}
                      {i.by && ` · by ${i.by.name}`}
                    </span>
                    {!expired && !full && (
                      <form action={endInvite}>
                        <input type="hidden" name="token" value={i.token} />
                        <button
                          type="submit"
                          className="h-9 rounded-lg border border-neutral-300 px-3 font-medium dark:border-neutral-700"
                        >
                          End now
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
