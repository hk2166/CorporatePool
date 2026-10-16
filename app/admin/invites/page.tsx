import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/app/admin/admin-nav";
import { AppHeader } from "@/components/app-header";
import { getCurrentAdmin } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { endInvite } from "./actions";
import { InviteForm } from "./invite-form";
import { ShareRideButton } from "@/components/share-ride-button";
import { NO_LIMIT, splitInvites } from "@/lib/invites";

export const metadata: Metadata = { title: "Invites · Admin · CorporatePool" };

export default function InvitesPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 lg:max-w-5xl space-y-6 px-4 py-6">
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
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { open, ended } = splitInvites(invites ?? []);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
        <p className="text-sm text-neutral-500">
          Share a link in the WhatsApp group: anyone who opens it and signs in
          with Google joins, until it ends or its places run out. You choose how
          long it stays open. People without a link can ask to join instead;
          they wait under Requests until you accept them.
        </p>
        <InviteForm site={site} />
      </section>

      {open.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Open links ({open.length})</h2>
          <ul className="space-y-2">
            {open.map((i) => {
              const link = `${site}/invite/${i.token}`;
              return (
                <li
                  key={i.token}
                  className="space-y-2 rounded-2xl border border-emerald-300 px-4 py-3 text-sm dark:border-emerald-800"
                >
                  <p className="font-mono break-all">{link}</p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {joined(i)} · open until{" "}
                    {dayLabel(indiaDate(new Date(i.expires_at)))}{" "}
                    {indiaTime(i.expires_at)}
                    {i.by && ` · by ${i.by.name}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ShareRideButton
                      message={`Join our office carpool on CorporatePool: ${link}`}
                      url={link}
                      label="Share"
                    />
                    <form action={endInvite}>
                      <input type="hidden" name="token" value={i.token} />
                      <button
                        type="submit"
                        className="h-10 rounded-lg border border-red-300 px-3 font-medium text-red-700 dark:border-red-800 dark:text-red-400"
                      >
                        End now
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ended.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Ended</h2>
          <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {ended.map((i) => (
              <li key={i.token} className="space-y-1 px-4 py-3 text-sm">
                <p className="font-mono break-all text-neutral-500">
                  {site}/invite/{i.token}
                </p>
                <p className="text-neutral-600 dark:text-neutral-400">
                  {joined(i)} ·{" "}
                  {i.used_count >= i.max_uses ? "places used up" : "ended"}{" "}
                  {dayLabel(indiaDate(new Date(i.expires_at)))}
                  {i.by && ` · by ${i.by.name}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type Invite = { used_count: number; max_uses: number; expires_at: string };

// "12 joined" for links without a limit, "12 of 50 joined" for the others.
function joined(i: Invite): string {
  return i.max_uses >= NO_LIMIT
    ? `${i.used_count} joined`
    : `${i.used_count} of ${i.max_uses} joined`;
}
