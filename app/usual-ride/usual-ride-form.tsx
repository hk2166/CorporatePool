"use client";

import { useActionState, useMemo, useState } from "react";
import { AddStopLink } from "@/components/add-stop-link";
import { suggestedPricePerSeat } from "@/lib/pricing";
import { MAX_STOPS, WEEKDAYS, type StopInput } from "@/lib/usual-ride";
import { saveUsualRide, type UsualRideFormState } from "./actions";

export type Place = { id: string; name: string; lat: number; lng: number };

type Props = {
  places: Place[];
  car: { id: string; seats: number };
  usualRide: {
    id: string;
    departTime: string;
    seats: number;
    price: number;
    notes: string;
    autoDays: number;
    stops: StopInput[];
  } | null;
};

const fieldClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function UsualRideForm({ places, car, usualRide }: Props) {
  const initial: UsualRideFormState = {
    saved: false,
    usualRideId: usualRide?.id,
  };
  const [state, action, pending] = useActionState(saveUsualRide, initial);

  // The form is controlled: stops and the price suggestion change as the owner edits.
  const [stops, setStops] = useState<StopInput[]>(
    usualRide?.stops ?? [
      { placeId: "", etaOffsetMin: 0 },
      { placeId: "", etaOffsetMin: 60 },
    ],
  );
  const [departTime, setDepartTime] = useState(
    usualRide?.departTime ?? "08:00",
  );
  const [seats, setSeats] = useState(
    usualRide?.seats ?? Math.min(3, car.seats),
  );
  const [price, setPrice] = useState(String(usualRide?.price ?? ""));
  const [notes, setNotes] = useState(usualRide?.notes ?? "");
  const [days, setDays] = useState<number>(usualRide?.autoDays ?? 0);

  const placeById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
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
  const removeStop = (index: number) =>
    setStops((current) => current.filter((_, i) => i !== index));
  const addStop = () =>
    setStops((current) => [
      ...current,
      {
        placeId: "",
        etaOffsetMin: (current.at(-1)?.etaOffsetMin ?? 0) + 15,
      },
    ]);

  const usualRideId = state.usualRideId ?? usualRide?.id;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="carId" value={car.id} />
      {usualRideId && (
        <input type="hidden" name="usualRideId" value={usualRideId} />
      )}
      <input type="hidden" name="stops" value={JSON.stringify(stops)} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Route</legend>
        <p className="text-sm text-neutral-500">
          Stops in order, with roughly how many minutes after setting off you
          reach each one.
        </p>
        <AddStopLink next="/usual-ride" empty={places.length === 0} />
        <ol className="space-y-2">
          {stops.map((stop, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-sm text-neutral-500">
                {index + 1}
              </span>
              <select
                aria-label={`Stop ${index + 1}`}
                value={stop.placeId}
                onChange={(e) => updateStop(index, { placeId: e.target.value })}
                className={`${fieldClass} min-w-0 flex-1`}
              >
                <option value="">Choose a stop</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
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
                    aria-label={`Minutes to stop ${index + 1}`}
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
              {stops.length > 2 && index > 0 && (
                <button
                  type="button"
                  onClick={() => removeStop(index)}
                  aria-label={`Remove stop ${index + 1}`}
                  className="h-12 shrink-0 rounded-xl px-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
        {stops.length < MAX_STOPS && (
          <button
            type="button"
            onClick={addStop}
            className="min-h-10 text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            + Add a stop
          </button>
        )}
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
        <label htmlFor="price" className="block text-sm font-medium">
          Price per seat (₹)
        </label>
        <input
          id="price"
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
          Go live automatically on (optional)
        </legend>
        <p className="text-sm text-neutral-500">
          On these days the ride goes up by itself the evening before. Leave
          them all off to tap &ldquo;Go live&rdquo; yourself.
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
          {pending ? "Saving…" : "Save my usual ride"}
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
