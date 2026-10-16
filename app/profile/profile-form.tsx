"use client";

import { useActionState, useState } from "react";
import { AddStopLink } from "@/components/add-stop-link";
import { CityStopSelect } from "@/components/city-stop-select";
import { pickedByOthers } from "@/lib/stop-choices";
import {
  saveProfile,
  type ProfileField,
  type ProfileFormState,
} from "./actions";

type Place = { id: string; name: string; lat: number; lng: number };

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
  // Only car owners are asked for a UPI ID (riders pay them with it).
  isOwner: boolean;
};

const initialState: ProfileFormState = { errors: {}, saved: false };

const inputClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function ProfileForm({ profile, places, welcome, isOwner }: Props) {
  const [state, action, pending] = useActionState(saveProfile, initialState);
  const error = (field: ProfileField) => state.errors[field];
  // After a failed save, show what was typed; otherwise what's saved.
  const value = (field: ProfileField, saved: string | null) =>
    state.values?.[field] ?? saved ?? "";
  // Home and office leave each other's stop out of their lists.
  const [home, setHome] = useState(value("home", profile.homePlaceId));
  const [work, setWork] = useState(value("work", profile.workPlaceId));

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

      {/* The commute goes both ways, so it's asked as two places: home and office. */}
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">
          What is your home location, and what is your office location?
        </legend>
        <p className="-mt-2 text-sm text-neutral-500">
          Pick your town, then the stop nearest to you. Rides go both ways: home
          to office in the morning, and back home in the evening.
        </p>
        <Field label="Home" field="home" error={error("home")}>
          <CityStopSelect
            key={value("home", profile.homePlaceId)}
            name="home"
            label="Home"
            places={places}
            defaultValue={value("home", profile.homePlaceId)}
            exclude={pickedByOthers([home, work], 0)}
            onChange={setHome}
            invalid={Boolean(error("home"))}
            describedBy={error("home") ? "home-error" : undefined}
          />
        </Field>
        <Field label="Office" field="work" error={error("work")}>
          <CityStopSelect
            key={value("work", profile.workPlaceId)}
            name="work"
            label="Office"
            places={places}
            defaultValue={value("work", profile.workPlaceId)}
            exclude={pickedByOthers([home, work], 1)}
            onChange={setWork}
            invalid={Boolean(error("work"))}
            describedBy={error("work") ? "work-error" : undefined}
          />
        </Field>
        <AddStopLink next="/profile" empty={places.length === 0} />
      </fieldset>

      {isOwner && (
        <Field
          label="UPI ID"
          field="upi"
          hint="Riders pay you directly with it, by UPI."
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
      )}

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
