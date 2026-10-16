"use client";

import { useActionState } from "react";
import { ShareRideButton } from "@/components/share-ride-button";
import { createInvite, type InviteState } from "./actions";

const initialState: InviteState = {};
const input =
  "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, initialState);
  return (
    <div className="space-y-4">
      <form
        action={action}
        className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
      >
        <label className="space-y-1 text-sm">
          <span className="block font-medium">People</span>
          <input
            name="uses"
            type="number"
            min={1}
            max={1000}
            defaultValue={50}
            className={input}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Days</span>
          <input
            name="days"
            type="number"
            min={1}
            max={60}
            defaultValue={14}
            className={input}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "…" : "Create"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-sm">
            {state.summary} Share it in your WhatsApp group:
          </p>
          <p className="font-mono text-sm break-all">{state.link}</p>
          <ShareRideButton
            message={`Join our office carpool on CorporatePool: ${state.link}`}
            url={state.link}
            label="Share to WhatsApp"
          />
        </div>
      )}
    </div>
  );
}
