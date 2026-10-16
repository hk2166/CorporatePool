"use client";

import { useActionState } from "react";
import { STATUS_LABEL } from "@/lib/feedback";
import { updateFeedback, type FeedbackUpdateState } from "./actions";

const initialState: FeedbackUpdateState = {};

// An item's status and the admin's reply, saved together.
export function StatusForm({
  id,
  title,
  status,
  reply,
}: {
  id: string;
  title: string;
  status: string;
  reply: string | null;
}) {
  const [state, run, pending] = useActionState(updateFeedback, initialState);
  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="feedbackId" value={id} />
      <input
        name="reply"
        maxLength={500}
        defaultValue={reply ?? ""}
        placeholder="Reply members will see (optional)"
        aria-label={`Reply: ${title}`}
        className="block h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="flex gap-2">
        <select
          name="status"
          defaultValue={status}
          aria-label={`Status: ${title}`}
          className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "…" : "Save"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.saved && !pending && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          Saved.
        </p>
      )}
    </form>
  );
}
