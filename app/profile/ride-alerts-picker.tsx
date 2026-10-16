"use client";

import { useActionState, useState } from "react";
import { RIDE_ALERTS, type RideAlerts } from "@/lib/ride-alerts";
import { setRideAlerts, type AlertsState } from "./alert-actions";

const initialState: AlertsState = {};

// Right away, once a day, or off: one tap saves.
export function RideAlertsPicker({ current }: { current: RideAlerts }) {
  const [state, run, pending] = useActionState(setRideAlerts, initialState);
  const [tapped, setTapped] = useState<RideAlerts | null>(null);
  const chosen = pending ? tapped : current;
  return (
    <form action={run} className="space-y-2">
      <div className="grid gap-2">
        {RIDE_ALERTS.map((a) => (
          <button
            key={a.value}
            type="submit"
            name="alerts"
            value={a.value}
            disabled={pending}
            aria-pressed={chosen === a.value}
            onClick={() => setTapped(a.value)}
            className={`flex w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition disabled:opacity-70 ${
              chosen === a.value
                ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950"
                : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
          >
            <span className="font-medium">{a.title}</span>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {a.detail}
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
          Saved.
        </p>
      )}
    </form>
  );
}
