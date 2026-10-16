"use client";

import { useState } from "react";
import { cityOf, groupByCity } from "@/lib/cities";

type Place = { id: string; name: string; lat: number; lng: number };

const selectClass =
  "h-12 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

// Pick a town first, then one of its stops, side by side: "Palwal" · "Agra Chowk". The stop
// is what the form sends (as `name`); the town only narrows the list. Opens on the town of
// the stop already chosen.
export function CityStopSelect({
  name,
  label,
  places,
  defaultValue,
  invalid = false,
  describedBy,
}: {
  name: string;
  label: string;
  places: readonly Place[];
  defaultValue: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const groups = groupByCity(places);
  const chosen = places.find((p) => p.id === defaultValue);
  const [city, setCity] = useState(chosen ? cityOf(chosen) : "");
  const stops = groups.find((g) => g.city === city)?.places ?? [];

  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
      <select
        aria-label={`${label}: town`}
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className={selectClass}
      >
        <option value="">Town</option>
        {groups.map((g) => (
          <option key={g.city} value={g.city}>
            {g.city}
          </option>
        ))}
      </select>
      <select
        // A new town means a new list: the key starts the stop over.
        key={`${city}:${defaultValue}`}
        id={name}
        name={name}
        aria-label={`${label}: stop`}
        defaultValue={
          stops.some((p) => p.id === defaultValue) ? defaultValue : ""
        }
        disabled={!city}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${selectClass} disabled:opacity-60`}
      >
        <option value="">{city ? "Choose a stop" : "Pick a town first"}</option>
        {stops.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// The stops in a native list, under one heading per town. For pickers that stay a single
// list (search, the usual ride).
export function StopOptions({ places }: { places: readonly Place[] }) {
  return groupByCity(places).map((g) => (
    <optgroup key={g.city} label={g.city}>
      {g.places.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </optgroup>
  ));
}
