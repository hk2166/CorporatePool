"use client";

import { useActionState, useState } from "react";
import { goLive, type GoLiveState } from "./actions";

type Props = {
  usualRideId: string;
  // YYYY-MM-DD dates in India, with labels like "Tomorrow · Sat, 17 Oct".
  days: { value: string; label: string }[];
  defaultDay: string;
  departTime: string;
  seats: number;
  carSeats: number;
  price: number;
  route: string;
  // "Offer your morning ride"
  title: string;
};

const initialState: GoLiveState = {};

// "Go live for tomorrow — 08:00, 3 seats, ₹110?" (user flow 3). One tap, with an optional
// change of time or seats for that day only.
export function GoLiveCard(props: Props) {
  const [state, action, pending] = useActionState(goLive, initialState);
  const [changing, setChanging] = useState(false);
  const [day, setDay] = useState(props.defaultDay);

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"
    >
      <input type="hidden" name="usualRideId" value={props.usualRideId} />
      <input type="hidden" name="day" value={day} />

      <div className="space-y-1">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          {props.title}
        </p>
        <p className="text-lg font-semibold">{props.route}</p>
        {!changing && (
          <p className="text-neutral-700 dark:text-neutral-300">
            {props.departTime} · {props.seats} seat
            {props.seats === 1 ? "" : "s"} · ₹{props.price} a seat
          </p>
        )}
      </div>

      <div className="flex gap-2" role="radiogroup" aria-label="Day">
        {props.days.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={day === option.value}
            onClick={() => setDay(option.value)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
              day === option.value
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {changing ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Sets off at</span>
            <input
              type="time"
              name="departTime"
              defaultValue={props.departTime}
              className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Seats</span>
            <select
              name="seats"
              defaultValue={props.seats}
              className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            >
              {Array.from({ length: props.carSeats }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          Change time or seats for this day
        </button>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Going live…" : "Go live"}
      </button>
    </form>
  );
}
