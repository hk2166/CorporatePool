"use server";

import { getCurrentUser } from "@/lib/auth";
import {
  MAX_CAR_PHOTOS,
  cleanCarText,
  isIndianPlate,
  normalizePlate,
} from "@/lib/car-fields";
import { createClient } from "@/lib/supabase/server";

export type CarField = "model" | "colour" | "plate" | "seats" | "photos";

export type CarFormState = {
  errors: Partial<Record<CarField | "form", string>>;
  saved: boolean;
  // What was submitted, so a failed save doesn't lose it (React resets forms after an action).
  values?: Partial<Record<Exclude<CarField, "photos">, string>>;
  carId?: string;
};

// Adds or updates the signed-in person's car (F-A3). Photos are already in Storage by now: the
// browser uploads them into the person's own folder, and this saves their paths.
export async function saveCar(
  _previous: CarFormState,
  formData: FormData,
): Promise<CarFormState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const values = {
    model: text("model"),
    colour: text("colour"),
    plate: text("plate"),
    seats: text("seats"),
  };
  const errors: CarFormState["errors"] = {};

  const model = cleanCarText(values.model, 2, 60);
  if (!model) errors.model = "Enter the make and model, like Maruti Swift.";

  const colour = cleanCarText(values.colour, 2, 30);
  if (!colour) errors.colour = "Enter the colour, like White.";

  const plate = normalizePlate(values.plate);
  if (!isIndianPlate(plate)) {
    errors.plate =
      "Enter the number plate as it's written, like HR 26 AB 1234.";
  }

  const seats = Number(values.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 7) {
    errors.seats = "Choose how many passengers fit (1–7).";
  }

  // Only photos in the person's own folder, so nobody can attach someone else's pictures.
  const photos = formData.getAll("photo").map(String);
  if (photos.length > MAX_CAR_PHOTOS) {
    errors.photos = `At most ${MAX_CAR_PHOTOS} photos.`;
  } else if (photos.some((path) => !path.startsWith(`${user.id}/`))) {
    errors.photos = "Some photos couldn't be saved. Please add them again.";
  }

  if (Object.keys(errors).length > 0 || !model || !colour) {
    return { errors, saved: false, values };
  }

  const supabase = await createClient();
  const carId = text("carId") || null;
  const fields = {
    model,
    colour,
    plate,
    seats_total: seats,
    photo_paths: photos,
  };

  // Which photos were removed, so their files can be deleted too.
  let removed: string[] = [];
  if (carId) {
    const { data: before } = await supabase
      .rpc("get_car_private", { p_car_id: carId })
      .maybeSingle();
    removed = (before?.photo_paths ?? []).filter((p) => !photos.includes(p));
  }

  // As the signed-in person: the access rules (T-1.3) only let owners add and edit their own
  // cars, and only these columns.
  const result = carId
    ? await supabase
        .from("cars")
        .update(fields)
        .eq("id", carId)
        .eq("owner_id", user.id)
        .select("id")
        .single()
    : await supabase
        .from("cars")
        .insert({ ...fields, owner_id: user.id })
        .select("id")
        .single();

  if (result.error) {
    const message =
      result.error.code === "23505"
        ? { plate: "This number plate is already registered." }
        : { form: "Couldn't save your car. Please try again." };
    return { errors: message, saved: false, values };
  }

  if (removed.length > 0) {
    // Best effort: a photo file left behind is only wasted space, never visible to anyone.
    await supabase.storage.from("car-photos").remove(removed);
  }

  return { errors: {}, saved: true, carId: result.data.id };
}
