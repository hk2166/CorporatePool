"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  checkStops,
  DIRECTIONS,
  parseDepartTime,
  parseDirection,
  weekdaysToMask,
  type StopInput,
} from "@/lib/usual-ride";

export type UsualRideFormState = {
  error?: string;
  saved: boolean;
  usualRideId?: string;
};

// Saves one of the owner's usual rides (F-B1, F-B3), the template that "Go live" copies into a
// ride: the morning one (home → office) or the evening one (office → home).
export async function saveUsualRide(
  _previous: UsualRideFormState,
  formData: FormData,
): Promise<UsualRideFormState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();
  const supabase = await createClient();
  const fail = (error: string): UsualRideFormState => ({ error, saved: false });

  const { data: car } = await supabase
    .from("cars")
    .select("id, seats_total")
    .eq("owner_id", user.id)
    .eq("id", String(formData.get("carId") ?? ""))
    .maybeSingle();
  if (!car) return fail("Add your car first.");

  let stops: StopInput[];
  try {
    stops = JSON.parse(String(formData.get("stops") ?? "[]"));
  } catch {
    return fail("Please pick your stops again.");
  }
  const stopsProblem = checkStops(stops);
  if (stopsProblem) return fail(stopsProblem);

  const departTime = parseDepartTime(String(formData.get("departTime") ?? ""));
  if (!departTime) return fail("Pick a departure time.");

  const seats = Number(formData.get("seats"));
  if (!Number.isInteger(seats) || seats < 1 || seats > car.seats_total) {
    return fail(`Offer between 1 and ${car.seats_total} seats.`);
  }

  const priceText = String(formData.get("price") ?? "").trim();
  if (!priceText) return fail("Enter your price per seat for this route.");
  const price = Number(priceText);
  if (!Number.isInteger(price) || price < 0 || price > 5000) {
    return fail("Enter a price per seat in whole rupees.");
  }

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 280) return fail("Notes can be at most 280 characters.");

  const autoDays = weekdaysToMask(formData.getAll("days").map(Number));
  const direction = parseDirection(formData.get("direction"));

  // Stop names and coordinates come from the stop list, not from the browser.
  const { data: places } = await supabase.rpc("list_places");
  const byId = new Map((places ?? []).map((place) => [place.id, place]));
  const stopsJson = [];
  for (const stop of stops) {
    const place = byId.get(stop.placeId);
    if (!place)
      return fail("One of those stops no longer exists. Please pick again.");
    stopsJson.push({
      place_id: place.id,
      label: place.name,
      lat: place.lat,
      lng: place.lng,
      eta_offset_min: stop.etaOffsetMin,
    });
  }

  const fields = {
    car_id: car.id,
    depart_time: departTime,
    seats_offered: seats,
    price_per_seat: price,
    notes: notes || null,
    auto_golive_days: autoDays,
    stops: stopsJson,
    direction,
  };

  // As the owner: the access rules (T-1.3) only let owners manage their own usual rides.
  const existingId = String(formData.get("usualRideId") ?? "") || null;
  const result = existingId
    ? await supabase
        .from("usual_rides")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", existingId)
        .eq("owner_id", user.id)
        .select("id")
        .single()
    : await supabase
        .from("usual_rides")
        .insert({ ...fields, owner_id: user.id })
        .select("id")
        .single();

  if (result.error) {
    const word = DIRECTIONS.find((d) => d.value === direction)?.word;
    return fail(
      result.error.code === "23505"
        ? `You already have a ${word} ride: reload the page to change it.`
        : "Couldn't save your ride. Please try again.",
    );
  }
  return { saved: true, usualRideId: result.data.id };
}
