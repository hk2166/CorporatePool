import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";
import { JoinRequestForm } from "./join-request-form";

export const metadata: Metadata = { title: "Ask to join · CorporatePool" };

// Where someone lands after signing in with Google without having joined through an invite
// link (Q3). lib/auth.ts sends them here. They can ask to join, and an admin accepts or rejects
// the request (app/admin/requests).
export default function NoInvitePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <Suspense
        fallback={
          <div className="h-64 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        }
      >
        <JoinStatus />
      </Suspense>
      <SignOutButton />
    </main>
  );
}

async function JoinStatus() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const [{ data: profile }, { data: request }] = await Promise.all([
    supabase.rpc("get_my_profile").maybeSingle(),
    supabase
      .from("join_requests")
      .select("status, created_at")
      .eq("user_id", claimsData.claims.sub)
      .maybeSingle(),
  ]);
  if (profile) redirect(profile.removed_at ? "/removed" : "/");

  if (request?.status === "PENDING") {
    const asked = new Date(request.created_at);
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Request sent</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          You asked to join on {dayLabel(indiaDate(asked))} at{" "}
          {indiaTime(asked)}. An admin will look at it soon. Once you&apos;re
          accepted, come back here and you&apos;re in.
        </p>
        <Link
          href="/welcome"
          className="flex h-12 items-center justify-center rounded-xl border border-neutral-300 font-semibold dark:border-neutral-700"
        >
          Check again
        </Link>
      </div>
    );
  }

  if (request?.status === "REJECTED") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your request wasn&apos;t accepted
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          An admin turned down your request to join. If that&apos;s a mistake,
          ask your group admin for an invite link and open it on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Ask to join</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          CorporatePool is private, so everyone on it is part of the same
          commuting group. If your group admin sent you an invite link, open it
          on this device. Otherwise, ask to join and an admin will let you in.
        </p>
      </div>
      <JoinRequestForm />
    </div>
  );
}
