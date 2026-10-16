"use client";

import { useActionState } from "react";
import { blockUser, reportUser, type ReportState } from "./actions";

const initialState: ReportState = {};

export function ReportForm({
  aboutUser,
  rideId,
  firstName,
}: {
  aboutUser: string;
  rideId?: string;
  firstName: string;
}) {
  const [state, action, pending] = useActionState(reportUser, initialState);
  if (state.done) {
    return (
      <p
        role="status"
        className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      >
        Thanks. An admin will look at it. {firstName} isn&apos;t told who
        reported them.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="aboutUser" value={aboutUser} />
      {rideId && <input type="hidden" name="rideId" value={rideId} />}
      <label htmlFor="reason" className="block text-sm font-medium">
        What happened?
      </label>
      <textarea
        id="reason"
        name="reason"
        required
        minLength={5}
        maxLength={1000}
        rows={4}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-neutral-900 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Sending…" : "Send to the admins"}
      </button>
    </form>
  );
}

export function BlockForm({
  aboutUser,
  firstName,
  blocked,
}: {
  aboutUser: string;
  firstName: string;
  blocked: boolean;
}) {
  const [state, action, pending] = useActionState(blockUser, initialState);
  if (blocked || state.done) {
    return (
      <p
        role="status"
        className="text-sm text-neutral-600 dark:text-neutral-400"
      >
        You&apos;ve blocked {firstName}. You can unblock them from your profile.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="aboutUser" value={aboutUser} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        You&apos;ll never be matched with {firstName} again, and any seat
        between you on a ride still to come ends. {firstName} isn&apos;t told
        they were blocked.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-red-600 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Blocking…" : `Block ${firstName}`}
      </button>
    </form>
  );
}
