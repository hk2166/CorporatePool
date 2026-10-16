"use client";

import { useActionState } from "react";
import { AddStopLink } from "@/components/add-stop-link";
import {
  saveProfile,
  type ProfileField,
  type ProfileFormState,
} from "./actions";

type Place = { id: string; name: string };

type Props = {
  profile: {
    name: string;
    phone: string | null;
    upiId: string | null;
    homePlaceId: string | null;
    workPlaceId: string | null;
  };
  places: Place[];
  // Finishing sign-up: saving moves on to the home page.
  welcome: boolean;
};

const initialState: ProfileFormState = { errors: {}, saved: false };

const inputClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function ProfileForm({ profile, places, welcome }: Props) {
  const [state, action, pending] = useActionState(saveProfile, initialState);
  const error = (field: ProfileField) => state.errors[field];
  // After a failed save, show what was typed; otherwise what's saved.
  const value = (field: ProfileField, saved: string | null) =>
    state.values?.[field] ?? saved ?? "";

  return (
    <form action={action} className="space-y-5" noValidate>
      {welcome && <input type="hidden" name="welcome" value="1" />}

      <Field label="Name" field="name" error={error("name")}>
        <input
          id="name"
          name="name"
          defaultValue={value("name", profile.name)}
          autoComplete="name"
          maxLength={80}
          required
          aria-invalid={Boolean(error("name"))}
          aria-describedby={error("name") ? "name-error" : undefined}
          className={inputClass}
        />
      </Field>

      <Field
        label="Mobile number"
        field="phone"
        hint="Only someone in a confirmed booking with you can see it."
        error={error("phone")}
      >
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={value(
            "phone",
            profile.phone?.replace(/^\+91/, "") ?? null,
          )}
          placeholder="98765 43210"
          autoComplete="tel-national"
          required
          aria-invalid={Boolean(error("phone"))}
          aria-describedby={error("phone") ? "phone-error" : "phone-hint"}
          className={inputClass}
        />
      </Field>

      <Field
        label="Usual pickup stop"
        field="home"
        hint="Used for one-tap search. A landmark, not your address."
        error={error("home")}
      >
        <PlaceSelect
          name="home"
          places={places}
          defaultValue={value("home", profile.homePlaceId)}
          invalid={Boolean(error("home"))}
        />
      </Field>

      <Field label="Usual office stop" field="work" error={error("work")}>
        <PlaceSelect
          name="work"
          places={places}
          defaultValue={value("work", profile.workPlaceId)}
          invalid={Boolean(error("work"))}
        />
      </Field>
      <AddStopLink next="/profile" empty={places.length === 0} />

      <Field
        label="UPI ID (car owners)"
        field="upi"
        hint="Riders pay you directly with it. Leave empty if you only ride."
        error={error("upi")}
      >
        <input
          id="upi"
          name="upi"
          defaultValue={value("upi", profile.upiId)}
          placeholder="name@okaxis"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(error("upi"))}
          aria-describedby={error("upi") ? "upi-error" : "upi-hint"}
          className={inputClass}
        />
      </Field>

      {state.errors.form && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {state.errors.form}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-xl bg-emerald-600 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : welcome ? "Save and continue" : "Save"}
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

function Field({
  label,
  field,
  hint,
  error,
  children,
}: {
  label: string;
  field: ProfileField;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={field} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${field}-error`}
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${field}-hint`} className="text-sm text-neutral-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function PlaceSelect({
  name,
  places,
  defaultValue,
  invalid,
}: {
  name: "home" | "work";
  places: Place[];
  defaultValue: string;
  invalid: boolean;
}) {
  return (
    <select
      // React only applies a select's defaultValue when it's created, so a new key recreates
      // it when the value to show changes (after a failed save).
      key={defaultValue}
      id={name}
      name={name}
      defaultValue={defaultValue}
      aria-invalid={invalid}
      aria-describedby={invalid ? `${name}-error` : undefined}
      className={inputClass}
    >
      <option value="">Not set</option>
      {places.map((place) => (
        <option key={place.id} value={place.id}>
          {place.name}
        </option>
      ))}
    </select>
  );
}
