"use client";

import { useActionState } from "react";
import {
  addRequestedStop,
  deleteStop,
  mergeStops,
  rejectStopRequest,
  saveStop,
  type StopState,
} from "./actions";

const initialState: StopState = {};
const input =
  "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const KINDS = ["landmark", "metro", "office", "town"] as const;

function Feedback({ state }: { state: StopState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  if (state.done)
    return (
      <p
        role="status"
        className="text-sm text-emerald-700 dark:text-emerald-400"
      >
        {state.done}
      </p>
    );
  return null;
}

// Add a stop (no id) or change one.
export function StopForm({
  id,
  name = "",
  kind = "landmark",
  coordinates = "",
  submitLabel,
}: {
  id?: string;
  name?: string;
  kind?: string;
  coordinates?: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveStop, initialState);
  return (
    <form action={action} className="space-y-2">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={80}
          placeholder="Name, e.g. Palwal Bus Stand"
          aria-label="Name"
          className={input}
        />
        <select
          name="kind"
          defaultValue={kind}
          aria-label="Kind"
          className={input}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <input
          name="coordinates"
          defaultValue={coordinates}
          required
          placeholder="Google Maps link, or 28.1440, 77.3290"
          aria-label="Google Maps link or coordinates"
          className={input}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "…" : submitLabel}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteStopForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteStop, initialState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-800 dark:text-red-400"
      >
        {pending ? "…" : `Delete ${name}`}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function MergeForm({
  stops,
}: {
  stops: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(mergeStops, initialState);
  return (
    <form action={action} className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <select
          name="from"
          required
          defaultValue=""
          aria-label="Duplicate"
          className={input}
        >
          <option value="" disabled>
            Duplicate
          </option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-neutral-500">into</span>
        <select
          name="into"
          required
          defaultValue=""
          aria-label="Keep"
          className={input}
        >
          <option value="" disabled>
            Stop to keep
          </option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
      >
        {pending ? "Merging…" : "Merge"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// A member's stop request: add it as a stop (name, kind and position can be fixed first), or
// turn it down.
export function StopRequestForm({
  requestId,
  name,
  coordinates,
}: {
  requestId: string;
  name: string;
  coordinates: string;
}) {
  const [state, action, pending] = useActionState(
    addRequestedStop,
    initialState,
  );
  const [rejected, reject, rejecting] = useActionState(
    rejectStopRequest,
    initialState,
  );
  return (
    <div className="space-y-2">
      <form action={action} className="space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            name="name"
            defaultValue={name}
            required
            minLength={2}
            maxLength={80}
            aria-label={`Name for ${name}`}
            className={input}
          />
          <select
            name="kind"
            defaultValue="landmark"
            aria-label={`Kind for ${name}`}
            className={input}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            name="coordinates"
            defaultValue={coordinates}
            required
            placeholder="Google Maps link, or 28.1440, 77.3290"
            aria-label={`Where ${name} is`}
            className={input}
          />
          <button
            type="submit"
            disabled={pending}
            aria-label={`Add ${name}`}
            className="h-10 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "…" : "Add stop"}
          </button>
        </div>
        <Feedback state={state} />
      </form>
      <form action={reject}>
        <input type="hidden" name="requestId" value={requestId} />
        <button
          type="submit"
          disabled={rejecting}
          aria-label={`Turn down ${name}`}
          className="h-9 rounded-lg border border-neutral-300 px-3 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
        >
          {rejecting ? "…" : "Turn down"}
        </button>
        <Feedback state={rejected} />
      </form>
    </div>
  );
}
