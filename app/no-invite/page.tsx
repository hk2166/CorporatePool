import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Invite needed · CorporatePool" };

// Where someone lands after signing in with Google without having joined through an invite
// link (Q3: invite-only). lib/auth.ts sends them here.
export default function NoInvitePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          You need an invite
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          CorporatePool is invite-only, so everyone on it is part of the same
          commuting group. Ask your group admin for an invite link and open it
          on this device. If you already opened one, it may have expired or been
          used up.
        </p>
      </div>
      <SignOutButton />
    </main>
  );
}
