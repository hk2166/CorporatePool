"use client";

import { useActionState } from "react";
import { decideJoinRequest, type DecisionState } from "./actions";

const initialState: DecisionState = {};

// Accept and Reject for one join request (or just Accept, to undo a rejection).
export function DecisionButtons({
  userId,
  name,
  canReject = true,
}: {
  userId: string;
  name: string;
  canReject?: boolean;
}) {
  const [state, run, pending] = useActionState(decideJoinRequest, initialState);
  return (
    <form action={run} className="space-y-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="accept"
          disabled={pending}
          aria-label={`Accept ${name}`}
          className="h-10 flex-1 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Accept
        </button>
        {canReject && (
          <button
            type="submit"
            name="decision"
            value="reject"
            disabled={pending}
            aria-label={`Reject ${name}`}
            className="h-10 flex-1 rounded-lg border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Reject
          </button>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
