"use client";

import Image from "next/image";
import { useActionState, useRef, useState, type ChangeEvent } from "react";
import { MAX_CAR_PHOTOS } from "@/lib/car-fields";
import { resizeForUpload } from "@/lib/resize-image";
import { createClient } from "@/lib/supabase/client";
import { saveCar, type CarField, type CarFormState } from "./actions";

export type CarPhoto = { path: string; url: string };

type Props = {
  userId: string;
  car: {
    id: string;
    model: string;
    colour: string;
    plate: string;
    seats: number;
    photos: CarPhoto[];
  } | null;
};

const inputClass =
  "h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 aria-invalid:border-red-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

export function CarForm({ userId, car }: Props) {
  const initial: CarFormState = { errors: {}, saved: false, carId: car?.id };
  const [state, action, pending] = useActionState(saveCar, initial);
  const [photos, setPhotos] = useState<CarPhoto[]>(car?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const carId = state.carId ?? car?.id;
  const error = (field: CarField) => state.errors[field];
  const value = (field: Exclude<CarField, "photos">, saved: string) =>
    state.values?.[field] ?? saved;

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const room = MAX_CAR_PHOTOS - photos.length;
    if (files.length > room) {
      setUploadError(`You can add ${room} more photo${room === 1 ? "" : "s"}.`);
      return;
    }

    setUploading(true);
    setUploadError(null);
    const storage = createClient().storage.from("car-photos");
    try {
      const added: CarPhoto[] = [];
      for (const file of files) {
        const blob = await resizeForUpload(file);
        // Into the person's own folder: the only place Storage lets them upload.
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error } = await storage.upload(path, blob, {
          contentType: "image/jpeg",
        });
        if (error) throw error;
        added.push({ path, url: URL.createObjectURL(blob) });
      }
      setPhotos((current) => [...current, ...added]);
    } catch {
      setUploadError("A photo couldn't be uploaded. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {carId && <input type="hidden" name="carId" value={carId} />}
      {photos.map((photo) => (
        <input key={photo.path} type="hidden" name="photo" value={photo.path} />
      ))}

      <Field label="Make and model" field="model" error={error("model")}>
        <input
          id="model"
          name="model"
          defaultValue={value("model", car?.model ?? "")}
          placeholder="Maruti Swift"
          maxLength={60}
          aria-invalid={Boolean(error("model"))}
          className={inputClass}
        />
      </Field>

      <Field label="Colour" field="colour" error={error("colour")}>
        <input
          id="colour"
          name="colour"
          defaultValue={value("colour", car?.colour ?? "")}
          placeholder="White"
          maxLength={30}
          aria-invalid={Boolean(error("colour"))}
          className={inputClass}
        />
      </Field>

      <Field
        label="Number plate"
        field="plate"
        hint="Riders see it only once their seat is confirmed."
        error={error("plate")}
      >
        <input
          id="plate"
          name="plate"
          defaultValue={value("plate", car?.plate ?? "")}
          placeholder="HR 26 AB 1234"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(error("plate"))}
          className={`${inputClass} uppercase`}
        />
      </Field>

      <Field
        label="Passenger seats"
        field="seats"
        hint="Not counting the driver. You choose how many to offer on each ride."
        error={error("seats")}
      >
        <select
          // Recreated when the value to show changes, as React only applies defaultValue once.
          key={value("seats", String(car?.seats ?? 4))}
          id="seats"
          name="seats"
          defaultValue={value("seats", String(car?.seats ?? 4))}
          aria-invalid={Boolean(error("seats"))}
          className={inputClass}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Photos</legend>
        <p className="text-sm text-neutral-500">
          Up to {MAX_CAR_PHOTOS}. They help riders spot your car, and only
          riders with a confirmed seat can see them.
        </p>
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <li
              key={photo.path}
              className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800"
            >
              <Image
                src={photo.url}
                alt="Your car"
                fill
                sizes="128px"
                unoptimized
                className="object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setPhotos((current) =>
                    current.filter((p) => p.path !== photo.path),
                  )
                }
                className="absolute top-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                aria-label="Remove this photo"
              >
                Remove
              </button>
            </li>
          ))}
          {photos.length < MAX_CAR_PHOTOS && (
            <li>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-sm text-neutral-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400"
              >
                {uploading ? "Uploading…" : "+ Add"}
              </button>
            </li>
          )}
        </ul>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={addPhotos}
          className="hidden"
          aria-label="Add car photos"
        />
        {(uploadError || error("photos")) && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {uploadError ?? error("photos")}
          </p>
        )}
      </fieldset>

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
          disabled={pending || uploading}
          className="h-12 flex-1 rounded-xl bg-emerald-600 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : car || state.carId ? "Save" : "Add my car"}
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
  field: CarField;
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
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        hint && <p className="text-sm text-neutral-500">{hint}</p>
      )}
    </div>
  );
}
