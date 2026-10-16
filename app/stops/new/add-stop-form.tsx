"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatCoordinates } from "@/lib/coordinates";
import { addStop, type AddStopState } from "./actions";

const initialState: AddStopState = {};
const inputClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// Name the stop, then say where it is: a Google Maps link (or coordinates), or the phone's
// location when standing there. Members ask for a stop (where it is helps but is optional);
// admins add it, so for them it's needed.
export function AddStopForm({
  next,
  isAdmin,
}: {
  next: string;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(addStop, initialState);
  const [location, setLocation] = useState(state.values?.location ?? "");
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
        setLocation(
          formatCoordinates(
            position.coords.latitude,
            position.coords.longitude,
          ),
        );
        setLocating(false);
      },
      () => {
        setLocationError(
          "Couldn't get your location. Allow location access, or paste a Google Maps link instead.",
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
        <label htmlFor="location" className="block text-sm font-medium">
          Google Maps link{" "}
          {!isAdmin && (
            <span className="font-normal text-neutral-500">(optional)</span>
          )}
        </label>
        <input
          id="location"
          name="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required={isAdmin}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://maps.app.goo.gl/…"
          aria-describedby="location-hint"
          className={inputClass}
        />
        <p id="location-hint" className="text-sm text-neutral-500">
          In Google Maps, press and hold the spot to drop a pin, tap Share, then
          Copy link, and paste it here. Coordinates like 28.1440, 77.3290 work
          too.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="h-12 w-full rounded-xl border border-emerald-500 font-medium text-emerald-700 disabled:opacity-60 dark:text-emerald-400"
        >
          {locating ? "Finding you…" : "Standing there? Use my location"}
        </button>
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
          {pending
            ? isAdmin
              ? "Adding…"
              : "Sending…"
            : isAdmin
              ? "Add stop"
              : "Send request"}
        </button>
        <Link
          href={next}
          className="inline-flex min-h-10 items-center px-3 text-sm text-neutral-500 underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
