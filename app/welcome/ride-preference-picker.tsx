"use client";

import { useActionState, useState } from "react";
import { RIDE_PREFERENCES, type RidePreference } from "@/lib/ride-preference";
import { setRidePreference, type PreferenceState } from "./actions";

const initialState: PreferenceState = {};

// The three answers as big buttons: one tap saves. Used on /welcome (where it then carries on
// with sign-up) and on the profile page.
export function RidePreferencePicker({
  current,
  onboarding = false,
}: {
  current: RidePreference | null;
  onboarding?: boolean;
}) {
  const [state, run, pending] = useActionState(setRidePreference, initialState);
  // The tapped answer shows as chosen straight away, before the server answers.
  const [tapped, setTapped] = useState<RidePreference | null>(null);
  const chosen = pending ? tapped : current;

  return (
    <form action={run} className="space-y-3">
      {onboarding && <input type="hidden" name="next" value="onboarding" />}
      <div className="grid gap-3">
        {RIDE_PREFERENCES.map((p) => (
          <button
            key={p.value}
            type="submit"
            name="preference"
            value={p.value}
            disabled={pending}
            aria-pressed={chosen === p.value}
            onClick={() => setTapped(p.value)}
            className={`flex w-full flex-col items-start gap-1 rounded-2xl border p-4 text-left transition disabled:opacity-70 ${
              chosen === p.value
                ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950"
                : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
          >
            <span className="font-semibold">{p.title}</span>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {p.detail}
            </span>
          </button>
        ))}
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
          {current === "DRIVER" || current === "BOTH"
            ? "Saved. Offer and Car are in the menu now: list your car, then your rides and price."
            : "Saved. Your home page now shows this first."}
        </p>
      )}
    </form>
  );
}
