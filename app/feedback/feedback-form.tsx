"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "./actions";

const initialState: FeedbackState = {};

const KINDS = [
  { value: "IDEA", label: "An idea" },
  { value: "PROBLEM", label: "A problem" },
] as const;

// Send an idea or a problem. After sending, the form starts fresh (its key changes).
export function FeedbackForm() {
  const [state, run, pending] = useActionState(sendFeedback, initialState);
  const values = state.values;
  return (
    <form
      key={state.sent ?? 0}
      action={run}
      className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <fieldset className="flex gap-2">
        <legend className="sr-only">Is it an idea or a problem?</legend>
        {KINDS.map((k) => (
          <label key={k.value} className="flex-1">
            <input
              type="radio"
              name="kind"
              value={k.value}
              defaultChecked={(values?.kind ?? "IDEA") === k.value}
              className="peer sr-only"
            />
            <span className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-neutral-300 text-sm font-medium peer-checked:border-neutral-900 peer-checked:bg-neutral-900 peer-checked:text-white peer-focus-visible:ring-2 dark:border-neutral-700 dark:peer-checked:border-white dark:peer-checked:bg-white dark:peer-checked:text-neutral-900">
              {k.label}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1">
        <span className="text-sm font-medium">In a few words</span>
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={values?.title}
          placeholder="e.g. Rides home in the evening"
          className="block h-11 w-full rounded-xl border border-neutral-300 bg-transparent px-3 dark:border-neutral-700"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          More detail{" "}
          <span className="font-normal text-neutral-500">(optional)</span>
        </span>
        <textarea
          name="details"
          rows={3}
          maxLength={1000}
          defaultValue={values?.details}
          className="block w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send feedback"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.sent && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          Thanks! It&apos;s on the list below with your vote.
        </p>
      )}
    </form>
  );
}
