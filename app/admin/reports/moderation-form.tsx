"use client";

import { useActionState } from "react";
import type { ModerationState } from "./actions";

const initialState: ModerationState = {};

// One admin action: a reason for the audit trail, and a button.
export function ModerationForm({
  action,
  fields,
  label,
  placeholder,
  danger = false,
}: {
  action: (
    previous: ModerationState,
    formData: FormData,
  ) => Promise<ModerationState>;
  fields: Record<string, string>;
  label: string;
  placeholder: string;
  danger?: boolean;
}) {
  const [state, run, pending] = useActionState(action, initialState);
  return (
    <form action={run} className="space-y-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex gap-2">
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder={placeholder}
          aria-label={`Reason: ${label}`}
          className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending}
          className={`h-10 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap disabled:opacity-60 ${
            danger
              ? "bg-red-600 text-white"
              : "border border-neutral-300 dark:border-neutral-700"
          }`}
        >
          {pending ? "…" : label}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
