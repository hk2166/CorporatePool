"use client";

import { useActionState } from "react";
import {
  completeRide,
  markRider,
  startRide,
  type RideActionState,
} from "./actions";

const initialState: RideActionState = {};

// One button that runs one Server Action, with hidden fields and its own error line.
function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  className,
}: {
  action: (
    previous: RideActionState,
    formData: FormData,
  ) => Promise<RideActionState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const [state, run, pending] = useActionState(action, initialState);
  return (
    <form action={run} className="contents">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p
          role="alert"
          className="basis-full text-sm text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}

const big =
  "h-12 w-full rounded-xl font-semibold text-white transition disabled:opacity-60";
const small =
  "h-9 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-60";

export function StartRideButton({ rideId }: { rideId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        action={startRide}
        fields={{ rideId }}
        label="Start ride"
        pendingLabel="Starting…"
        className={`${big} bg-emerald-600 hover:bg-emerald-700`}
      />
    </div>
  );
}

export function CompleteRideButton({ rideId }: { rideId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        action={completeRide}
        fields={{ rideId }}
        label="Finish ride"
        pendingLabel="Finishing…"
        className={`${big} bg-neutral-900 hover:bg-neutral-700 dark:bg-white dark:text-neutral-900`}
      />
    </div>
  );
}

// Came / Didn't come for one rider while the ride is under way, or Undo once marked.
export function MarkRider({
  bookingId,
  mark,
}: {
  bookingId: string;
  mark: "none" | "picked_up" | "no_show";
}) {
  if (mark !== "none") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            mark === "picked_up"
              ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
              : "text-sm font-medium text-red-600 dark:text-red-400"
          }
        >
          {mark === "picked_up" ? "Came" : "Didn't come"}
        </span>
        <ActionButton
          action={markRider}
          fields={{ bookingId, outcome: "undo" }}
          label="Undo"
          pendingLabel="…"
          className={`${small} border-neutral-300 dark:border-neutral-700`}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        action={markRider}
        fields={{ bookingId, outcome: "picked_up" }}
        label="Came"
        pendingLabel="…"
        className={`${small} border-emerald-500 text-emerald-700 dark:text-emerald-400`}
      />
      <ActionButton
        action={markRider}
        fields={{ bookingId, outcome: "no_show" }}
        label="Didn't come"
        pendingLabel="…"
        className={`${small} border-red-400 text-red-600 dark:text-red-400`}
      />
    </div>
  );
}
