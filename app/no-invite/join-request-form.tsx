"use client";

import { useActionState } from "react";
import { requestToJoin, type JoinRequestState } from "./actions";

const initialState: JoinRequestState = {};

// "Ask to join", with an optional note so the admin knows who's asking.
export function JoinRequestForm() {
  const [state, run, pending] = useActionState(requestToJoin, initialState);
  return (
    <form action={run} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          A note for the admin{" "}
          <span className="font-normal text-neutral-500">(optional)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          maxLength={300}
          placeholder="Who you are, where you work, where you travel from"
          className="block w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Ask to join"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
