"use client";

import { useOptimistic, useTransition } from "react";
import { voteFeedback } from "./actions";

// The upvote: one tap to add your vote, another to take it back. The count changes at once and
// settles when the server answers.
export function VoteButton({
  id,
  title,
  votes,
  voted,
}: {
  id: string;
  title: string;
  votes: number;
  voted: boolean;
}) {
  const [state, setState] = useOptimistic({ votes, voted });
  const [, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={state.voted}
      aria-label={`Upvote: ${title}`}
      onClick={() =>
        startTransition(async () => {
          const next = !state.voted;
          setState({ voted: next, votes: state.votes + (next ? 1 : -1) });
          await voteFeedback(id, next);
        })
      }
      className={`flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition ${
        state.voted
          ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      }`}
    >
      <span aria-hidden className="text-xs leading-none">
        ▲
      </span>
      {state.votes}
    </button>
  );
}
