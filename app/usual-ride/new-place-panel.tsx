"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { addPlaceForRide, type NewPlace } from "./add-place-action";

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// "+ Add a new location" in a pickup or drop list: a name, and where it is (a Google Maps link,
// or where the owner is standing). It sits inside the ride's form, so it's not a form itself:
// Enter adds the stop instead of saving the ride.
export function NewPlacePanel({
  label,
  onAdded,
  onCancel,
}: {
  label: string;
  onAdded: (place: NewPlace, created: boolean) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addPlaceForRide({
        name,
        link: here ? undefined : link,
        lat: here?.lat,
        lng: here?.lng,
      });
      if ("error" in result) setError(result.error);
      else onAdded(result.place, result.created);
    });
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError(
        "This browser can't share your location. Paste a Google Maps link instead.",
      );
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLink("");
        setLocating(false);
      },
      () => {
        setError(
          "Couldn't get your location. Paste a Google Maps link instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950"
    >
      <p className="text-sm font-medium">New location</p>
      <label className="block space-y-1">
        <span className="text-sm">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter}
          placeholder="e.g. Sohna Chowk"
          maxLength={80}
          autoFocus
          className={inputClass}
        />
      </label>
      {here ? (
        <p className="text-sm">
          📍 Using where you are now.{" "}
          <button
            type="button"
            onClick={() => setHere(null)}
            className="underline"
          >
            Paste a link instead
          </button>
        </p>
      ) : (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm">Google Maps link</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={onEnter}
              inputMode="url"
              placeholder="https://maps.app.goo.gl/…"
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="text-sm font-medium text-emerald-700 disabled:opacity-60 dark:text-emerald-400"
          >
            {locating ? "Finding you…" : "📍 Or use my current location"}
          </button>
        </div>
      )}
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        It&apos;s added to everyone&apos;s list straight away.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add location"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
