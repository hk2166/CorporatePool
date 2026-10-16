"use client";

import { useState } from "react";
import { StopOptions } from "@/components/city-stop-select";
import { pickedByOthers } from "@/lib/stop-choices";

type Place = { id: string; name: string; lat: number; lng: number };

// Search's From and To: each leaves the other's stop out of its list, so a search can't be
// from a stop to itself.
export function RoutePicker({
  places,
  from,
  to,
  selectClass,
}: {
  places: readonly Place[];
  from: string;
  to: string;
  selectClass: string;
}) {
  const [picked, setPicked] = useState({ from, to });
  const picks = [picked.from, picked.to];
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="from" className="block text-sm font-medium">
          From
        </label>
        <select
          id="from"
          name="from"
          required
          defaultValue={from}
          onChange={(e) => setPicked((p) => ({ ...p, from: e.target.value }))}
          className={selectClass}
        >
          <option value="" disabled>
            Where you get in
          </option>
          <StopOptions places={places} exclude={pickedByOthers(picks, 0)} />
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="to" className="block text-sm font-medium">
          To
        </label>
        <select
          id="to"
          name="to"
          required
          defaultValue={to}
          onChange={(e) => setPicked((p) => ({ ...p, to: e.target.value }))}
          className={selectClass}
        >
          <option value="" disabled>
            Where you get out
          </option>
          <StopOptions places={places} exclude={pickedByOthers(picks, 1)} />
        </select>
      </div>
    </>
  );
}
