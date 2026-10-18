"use client";

import { useActionState } from "react";
import { cancelRide, saveRideNotes, type RideActionState } from "./actions";

const initialState: RideActionState = {};

export function RideNotes({
  rideId,
  notes,
}: {
  rideId: string;
  notes: string;
}) {
  const [state, action, pending] = useActionState(saveRideNotes, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="rideId" value={rideId} />
      <label htmlFor="notes" className="block text-sm font-medium">
        Notes for riders
      </label>
      <textarea
        id="notes"
        name="notes"
        defaultValue={notes}
        maxLength={280}
        rows={2}
        placeholder="AC, no smoking"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        {state.saved && !pending && (
          <span
            role="status"
            className="text-sm text-emerald-700 dark:text-emerald-400"
          >
            Saved
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

export function CancelRide({
  rideId,
  riders,
}: {
  rideId: string;
  // How many riders have a booking still in play.
  riders: number;
}) {
  const [state, action, pending] = useActionState(cancelRide, initialState);
  return (
    <details className="rounded-xl border border-red-200 p-4 dark:border-red-900">
      <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
        Cancel this ride
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="rideId" value={rideId} />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {riders === 0
            ? "Nobody has booked yet."
            : `${riders} rider${riders === 1 ? "" : "s"} will be told straight away, and riders happy with any car will be offered another one.`}{" "}
          Cancelling after 10 pm the evening before, with riders booked, lowers
          your reliability score.
        </p>
        <label htmlFor="reason" className="block text-sm font-medium">
          Reason (optional, riders see it)
        </label>
        <input
          id="reason"
          name="reason"
          maxLength={200}
          placeholder="Car at the service centre"
          className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-xl bg-red-600 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Cancel the ride"}
        </button>
      </form>
    </details>
  );
}
