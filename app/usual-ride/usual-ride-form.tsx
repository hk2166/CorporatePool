"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import { StopOptions } from "@/components/city-stop-select";
import { suggestedPricePerSeat } from "@/lib/pricing";
import { pickedByOthers } from "@/lib/stop-choices";
import {
  MAX_STOPS,
  WEEKDAYS,
  type Direction,
  type StopInput,
  type StopRole,
} from "@/lib/usual-ride";
import { saveUsualRide, type UsualRideFormState } from "./actions";
import { NewPlacePanel } from "./new-place-panel";

export type Place = { id: string; name: string; lat: number; lng: number };

// The last choice in every stop list: add a stop that isn't there.
const NEW_PLACE = "__new";

type Props = {
  direction: Direction;
  // 08:00 in the morning, 18:00 in the evening, until saved.
  defaultTime: string;
  places: Place[];
  car: { id: string; seats: number };
  usualRide: {
    id: string;
    departTime: string;
    seats: number;
    price: number | null;
    notes: string;
    autoDays: number;
    stops: StopInput[];
  } | null;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function UsualRideForm({
  direction,
  defaultTime,
  places,
  car,
  usualRide,
}: Props) {
  const initial: UsualRideFormState = {
    saved: false,
    usualRideId: usualRide?.id,
  };
  const [state, action, pending] = useActionState(saveUsualRide, initial);

  // The form is controlled: stops and the price suggestion change as the owner edits.
  const [stops, setStops] = useState<StopInput[]>(
    usualRide?.stops ?? [
      { placeId: "", etaOffsetMin: 0, role: "pickup" },
      { placeId: "", etaOffsetMin: 60, role: "drop" },
    ],
  );
  const [departTime, setDepartTime] = useState(
    usualRide?.departTime ?? defaultTime,
  );
  const [seats, setSeats] = useState(
    usualRide?.seats ?? Math.min(3, car.seats),
  );
  const [price, setPrice] = useState(String(usualRide?.price ?? ""));
  const [notes, setNotes] = useState(usualRide?.notes ?? "");
  const [days, setDays] = useState<number>(usualRide?.autoDays ?? 0);

  // Stops this owner adds here join the list at once; the page's list catches up on refresh.
  const router = useRouter();
  const [added, setAdded] = useState<Place[]>([]);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const allPlaces = useMemo(
    () => [
      ...places,
      ...added.filter((a) => !places.some((p) => p.id === a.id)),
    ],
    [places, added],
  );
  const placeById = useMemo(
    () => new Map(allPlaces.map((place) => [place.id, place])),
    [allPlaces],
  );
  const suggested = useMemo(() => {
    const route = stops
      .map((stop) => placeById.get(stop.placeId))
      .filter((place): place is Place => Boolean(place));
    return route.length === stops.length
      ? suggestedPricePerSeat(route, seats)
      : 0;
  }, [stops, seats, placeById]);

  const updateStop = (index: number, change: Partial<StopInput>) =>
    setStops((current) =>
      current.map((stop, i) => (i === index ? { ...stop, ...change } : stop)),
    );
  const removeStop = (index: number) => {
    setAddingAt(null);
    setStops((current) => current.filter((_, i) => i !== index));
  };
  // A new drop spot goes at the end; a new pickup spot after the last pickup, timed between
  // it and the first drop.
  const addStop = (role: StopRole) =>
    setStops((current) => {
      if (role === "drop") {
        return [
          ...current,
          {
            placeId: "",
            etaOffsetMin: (current.at(-1)?.etaOffsetMin ?? 0) + 15,
            role,
          },
        ];
      }
      const lastPickup = current.reduce(
        (last, stop, i) => (stop.role === "pickup" ? i : last),
        -1,
      );
      const before = current[lastPickup]?.etaOffsetMin ?? 0;
      const firstDrop = current[lastPickup + 1]?.etaOffsetMin;
      const etaOffsetMin =
        firstDrop === undefined
          ? before + 10
          : Math.max(before + 1, Math.min(before + 10, firstDrop - 1));
      const next = [...current];
      next.splice(lastPickup + 1, 0, { placeId: "", etaOffsetMin, role });
      return next;
    });

  const usualRideId = state.usualRideId ?? usualRide?.id;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="carId" value={car.id} />
      <input type="hidden" name="direction" value={direction} />
      {usualRideId && (
        <input type="hidden" name="usualRideId" value={usualRideId} />
      )}
      <input type="hidden" name="stops" value={JSON.stringify(stops)} />

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">
          What are your pickup spots, and what are your drop spots?
        </legend>
        <p className="text-sm text-neutral-500">
          In order, with roughly how many minutes after setting off you reach
          each one. Not in a list? Pick &ldquo;+ Add a new location&rdquo; at
          the bottom of it.
        </p>
        {notice && (
          <p
            role="status"
            className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            {notice}
          </p>
        )}
        {(["pickup", "drop"] as const).map((role) => {
          const group = stops
            .map((stop, index) => ({ stop, index }))
            .filter((x) => x.stop.role === role);
          const noun = role === "pickup" ? "Pickup spot" : "Drop spot";
          return (
            <div key={role} className="space-y-2">
              <div>
                <h3 className="text-sm font-medium">{noun}s</h3>
                <p className="text-sm text-neutral-500">
                  {role === "pickup"
                    ? "Where people get in. The first is where you set off."
                    : "Where people get out."}
                </p>
              </div>
              <ol className="space-y-2">
                {group.map(({ stop, index }, n) => (
                  <li key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-sm text-neutral-500">
                        {n + 1}
                      </span>
                      <select
                        aria-label={`${noun} ${n + 1}`}
                        value={stop.placeId}
                        onChange={(e) => {
                          if (e.target.value === NEW_PLACE) setAddingAt(index);
                          else updateStop(index, { placeId: e.target.value });
                        }}
                        className={`${fieldClass} min-w-0 flex-1`}
                      >
                        <option value="">Choose a spot</option>
                        <StopOptions
                          places={allPlaces}
                          exclude={pickedByOthers(
                            stops.map((s) => s.placeId),
                            index,
                          )}
                        />
                        <option value={NEW_PLACE}>+ Add a new location…</option>
                      </select>
                      {index === 0 ? (
                        <span className="w-24 shrink-0 text-sm text-neutral-500">
                          sets off
                        </span>
                      ) : (
                        <label className="flex w-24 shrink-0 items-center gap-1 text-sm text-neutral-500">
                          +
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={600}
                            aria-label={`Minutes to ${noun.toLowerCase()} ${n + 1}`}
                            value={stop.etaOffsetMin}
                            onChange={(e) =>
                              updateStop(index, {
                                etaOffsetMin: Number(e.target.value),
                              })
                            }
                            className="h-12 w-14 rounded-xl border border-neutral-300 bg-white px-2 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                          />
                          min
                        </label>
                      )}
                      {group.length > 1 && index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeStop(index)}
                          aria-label={`Remove ${noun.toLowerCase()} ${n + 1}`}
                          className="h-12 shrink-0 rounded-xl px-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {addingAt === index && (
                      <NewPlacePanel
                        label={`New location for ${noun.toLowerCase()} ${n + 1}`}
                        onCancel={() => setAddingAt(null)}
                        onAdded={(place, created) => {
                          setAdded((current) => [...current, place]);
                          updateStop(index, { placeId: place.id });
                          setAddingAt(null);
                          setNotice(
                            created
                              ? `Added “${place.name}”. It's in everyone's list now.`
                              : `“${place.name}” was already there, so it's picked.`,
                          );
                          router.refresh();
                        }}
                      />
                    )}
                  </li>
                ))}
              </ol>
              {stops.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={() => addStop(role)}
                  className="min-h-10 text-sm font-medium text-emerald-700 dark:text-emerald-400"
                >
                  + Add a {noun.toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Sets off at</span>
          <input
            type="time"
            name="departTime"
            value={departTime}
            onChange={(e) => setDepartTime(e.target.value)}
            required
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Seats to offer</span>
          <select
            name="seats"
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className={fieldClass}
          >
            {Array.from({ length: car.seats }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${direction}-price`}
          className="block text-sm font-medium"
        >
          Your price per seat for this route (₹)
        </label>
        <input
          id={`${direction}-price`}
          name="price"
          type="number"
          inputMode="numeric"
          min={0}
          max={5000}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={suggested ? String(suggested) : "150"}
          required
          className={fieldClass}
        />
        {suggested > 0 && (
          <p className="text-sm text-neutral-500">
            Fair share of the fuel for this route: about ₹{suggested}.{" "}
            {String(suggested) !== price && (
              <button
                type="button"
                onClick={() => setPrice(String(suggested))}
                className="font-medium text-emerald-700 dark:text-emerald-400"
              >
                Use ₹{suggested}
              </button>
            )}
          </p>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="block text-sm font-medium">Notes (optional)</span>
        <textarea
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="AC, no smoking"
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Post automatically on (optional)
        </legend>
        <p className="text-sm text-neutral-500">
          On these days your ride is posted by itself the evening before. Leave
          them all off to post it yourself each time.
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const on = (days & day.bit) !== 0;
            return (
              <label
                key={day.bit}
                className={`flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm ${
                  on
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <input
                  type="checkbox"
                  name="days"
                  value={day.bit}
                  checked={on}
                  onChange={() => setDays((current) => current ^ day.bit)}
                  className="sr-only"
                />
                {day.short}
              </label>
            );
          })}
        </div>
      </fieldset>

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
          className="h-12 flex-1 rounded-xl bg-emerald-600 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : `Save my ${direction === "EVENING" ? "evening" : "morning"} ride`}
        </button>
        {state.saved && !pending && (
          <p
            role="status"
            className="text-sm text-emerald-700 dark:text-emerald-400"
          >
            Saved
          </p>
        )}
      </div>
    </form>
  );
}
