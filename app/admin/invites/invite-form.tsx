"use client";

import { useActionState, useState } from "react";
import { ShareRideButton } from "@/components/share-ride-button";
import { DURATIONS } from "@/lib/invites";
import { createInvite, type InviteState } from "./actions";

const initialState: InviteState = {};
const input =
  "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900";

// A new invite link: an optional name, who can join, and for how long.
export function InviteForm({ site }: { site: string }) {
  const [state, action, pending] = useActionState(createInvite, initialState);

  return (
    <div className="space-y-4">
      <form
        action={action}
        className="space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
      >
        {/* A new key after each link starts the fields fresh; after an error they keep what
            was typed. */}
        <LinkFields
          key={state.link ?? "new"}
          site={site}
          values={state.values}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create link"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </form>

      {state.link && (
        <div className="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-sm">
            {state.summary} Share it in your WhatsApp group:
          </p>
          <p className="font-mono text-sm break-all">{state.link}</p>
          <div className="flex flex-wrap gap-2">
            <ShareRideButton
              message={`Join our office carpool on CorporatePool: ${state.link}`}
              url={state.link}
              label="Share to WhatsApp"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LinkFields({
  site,
  values,
}: {
  site: string;
  values: InviteState["values"];
}) {
  // The fields keep their own values (so the browser's reset after a save goes back to the
  // defaults); these only decide which extra fields show.
  const [duration, setDuration] = useState<string>(values?.duration ?? "7d");
  const [noLimit, setNoLimit] = useState(values?.noLimit ?? true);
  const host = site.replace(/^https?:\/\//, "");
  return (
    <>
      <label className="block space-y-1 text-sm">
        <span className="block font-medium">
          Link name{" "}
          <span className="font-normal text-neutral-500">(optional)</span>
        </span>
        <div className="flex items-center overflow-hidden rounded-lg border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <span className="shrink-0 pl-3 text-neutral-500">{host}/invite/</span>
          <input
            name="name"
            defaultValue={values?.name}
            placeholder="palwal-gurgaon"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Link name"
            className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none"
          />
        </div>
        <span className="block text-neutral-500">
          Easy to read and type. Leave it empty for a random link nobody can
          guess.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="block font-medium">Open for</span>
          <select
            name="duration"
            defaultValue={values?.duration ?? "7d"}
            onChange={(e) => setDuration(e.target.value)}
            className={input}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {duration === "until" && (
          <label className="block space-y-1 text-sm">
            <span className="block font-medium">Ends (India time)</span>
            <input
              name="until"
              type="datetime-local"
              required
              defaultValue={values?.until}
              className={input}
            />
          </label>
        )}
      </div>

      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Who can join</legend>
        <label className="flex min-h-10 items-center gap-2">
          <input
            type="checkbox"
            name="noLimit"
            defaultChecked={values?.noLimit ?? true}
            onChange={(e) => setNoLimit(e.target.checked)}
            className="h-5 w-5"
          />
          Anyone with the link, no limit
        </label>
        {!noLimit && (
          <label className="flex items-center gap-2">
            Up to
            <input
              name="uses"
              type="number"
              min={1}
              max={10000}
              defaultValue={values?.uses || 50}
              aria-label="How many people"
              className={`${input} w-28`}
            />
            people
          </label>
        )}
      </fieldset>
    </>
  );
}
