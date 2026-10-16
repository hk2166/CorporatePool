"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseCoordinates } from "@/lib/coordinates";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export type AddStopState = {
  error?: string;
  values?: { name: string; coordinates: string };
};

// Adds a stop to the shared list (or finds the one already there) and goes back to the page
// the member came from, which now offers it.
export async function addStop(
  _previous: AddStopState,
  formData: FormData,
): Promise<AddStopState> {
  await getCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const coordinates = String(formData.get("coordinates") ?? "");
  const values = { name, coordinates };
  const point = parseCoordinates(coordinates);
  if (name.length < 2 || name.length > 80) {
    return {
      error: "Give the stop a name people know, like a landmark.",
      values,
    };
  }
  if (!point) {
    return {
      error:
        'Tap "Use my current location", or paste coordinates like "28.4595, 77.0266".',
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("add_place", { p_name: name, p_lat: point.lat, p_lng: point.lng })
    .single();
  if (error || !data) {
    return { error: "Couldn't add the stop. Please try again.", values };
  }

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const url = new URL(next, "http://x");
  url.searchParams.set("stop", data.place_id);
  url.searchParams.set("stopAdded", data.created ? "new" : "existing");
  redirect(url.pathname + url.search);
}
