"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  cancelBooking,
  requestSeat,
  type RiderActionState,
} from "./rider-actions";

const initialState: RiderActionState = {};

const selectClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

type Stop = { seq: number; label: string; time: string };

// Request a seat (user flow 1 step 5): where you get in and out, how many seats, and whether
// any car that fits will do (F-C4).
export function RequestSeatForm({
  rideId,
  stops,
  pickup,
  drop,
  maxSeats,
  note,
}: {
  rideId: string;
  stops: Stop[];
  pickup: number;
  drop: number;
  maxSeats: number;
  // What happens next: "Ask any time until 22:00 …" or "Free seats go to whoever asks first".
  note: string;
}) {
  const [state, action, pending] = useActionState(requestSeat, initialState);
  const values = state.values;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rideId" value={rideId} />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="pickup" className="block text-sm font-medium">
            Get in at
          </label>
          <select
            id="pickup"
            name="pickup"
            key={values?.pickup ?? pickup}
            defaultValue={values?.pickup ?? String(pickup)}
            className={selectClass}
          >
            {stops.slice(0, -1).map((s) => (
              <option key={s.seq} value={s.seq}>
                {s.label} · {s.time}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="drop" className="block text-sm font-medium">
            Get out at
          </label>
          <select
            id="drop"
            name="drop"
            key={values?.drop ?? drop}
            defaultValue={values?.drop ?? String(drop)}
            className={selectClass}
          >
            {stops.slice(1).map((s) => (
              <option key={s.seq} value={s.seq}>
                {s.label} · {s.time}
              </option>
            ))}
          </select>
        </div>
      </div>

      {maxSeats > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="seats" className="block text-sm font-medium">
            Seats
          </label>
          <select
            id="seats"
            name="seats"
            key={values?.seats ?? "1"}
            defaultValue={values?.seats ?? "1"}
            className={selectClass}
          >
            {Array.from({ length: maxSeats }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <input
          type="checkbox"
          name="anyCarOk"
          defaultChecked={values?.anyCarOk ?? true}
          className="mt-1 h-4 w-4"
        />
        <span className="text-sm">
          <span className="font-medium">Put me in any car going my way</span>
          <span className="block text-neutral-500">
            If this car fills up, we&apos;ll find you a seat in another car on
            your route around the same time.
          </span>
        </span>
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}{" "}
          {state.error.startsWith("Add your mobile") && (
            <Link href="/profile" className="font-medium underline">
              Go to your profile
            </Link>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Asking…" : "Ask for a seat"}
      </button>
      <p className="text-sm text-neutral-500">{note}</p>
    </form>
  );
}

// Cancel a request, a waitlist place or a seat. Giving up a confirmed seat asks first, and
// says when it will lower the rider's score.
export function CancelBookingForm({
  bookingId,
  label,
  warning,
}: {
  bookingId: string;
  label: string;
  // Set for a confirmed seat: shown before the rider confirms.
  warning?: string;
}) {
  const [state, action, pending] = useActionState(cancelBooking, initialState);

  const form = (
    <form action={action} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {warning && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {warning}
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={
          warning
            ? "h-12 w-full rounded-xl bg-red-600 font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            : "h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
        }
      >
        {pending ? "Cancelling…" : warning ? "Yes, give up my seat" : label}
      </button>
    </form>
  );

  if (!warning) return form;
  return (
    <details className="rounded-xl border border-red-200 p-4 dark:border-red-900">
      <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
        {label}
      </summary>
      <div className="mt-3">{form}</div>
    </details>
  );
}
