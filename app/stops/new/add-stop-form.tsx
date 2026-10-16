"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatCoordinates } from "@/lib/coordinates";
import { addStop, type AddStopState } from "./actions";

const initialState: AddStopState = {};
const inputClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// Name the stop, then say where it is: the phone's location (standing at the stop), or
// coordinates copied from a map.
export function AddStopForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(addStop, initialState);
  const [coordinates, setCoordinates] = useState(
    state.values?.coordinates ?? "",
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("This browser can't share its location.");
      return;
    }
    setLocating(true);
    setLocationError(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates(
          formatCoordinates(
            position.coords.latitude,
            position.coords.longitude,
          ),
        );
        setLocating(false);
      },
      () => {
        setLocationError(
          "Couldn't get your location. Allow location access, or paste coordinates instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={state.values?.name}
          placeholder="A landmark people know, e.g. City Bus Stand"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="coordinates" className="block text-sm font-medium">
          Where it is
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="h-12 w-full rounded-xl border border-emerald-500 font-medium text-emerald-700 disabled:opacity-60 dark:text-emerald-400"
        >
          {locating ? "Finding you…" : "Use my current location"}
        </button>
        <input
          id="coordinates"
          name="coordinates"
          value={coordinates}
          onChange={(e) => setCoordinates(e.target.value)}
          placeholder="or paste coordinates: 28.4595, 77.0266"
          className={inputClass}
        />
        <p className="text-sm text-neutral-500">
          Standing at the stop? Use your location. Otherwise, in Google Maps,
          press and hold the spot and copy the numbers it shows.
        </p>
        {locationError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {locationError}
          </p>
        )}
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add stop"}
        </button>
        <Link href={next} className="px-3 text-sm text-neutral-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
