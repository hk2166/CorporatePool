"use server";

import { getCurrentUser } from "@/lib/auth";
import { isCarOwner } from "@/lib/ride-preference";
import { resolveLocation } from "@/lib/resolve-location";
import { createClient } from "@/lib/supabase/server";

export type NewPlace = { id: string; name: string; lat: number; lng: number };
export type AddPlaceResult =
  { place: NewPlace; created: boolean } | { error: string };

const NO_POSITION =
  "Couldn't find where that is. In Google Maps, press and hold the spot, tap Share, then Copy link, and paste it here. Or use your current location.";

// A car owner adds a stop that isn't in the list, from their ride's pickup and drop lists. It
// goes into everyone's list straight away (owner_add_place). Where it is comes from a Google
// Maps link (short ones are followed, only to Google) or the owner's current location.
export async function addPlaceForRide(input: {
  name: string;
  link?: string;
  lat?: number;
  lng?: number;
}): Promise<AddPlaceResult> {
  // Server Actions can be called directly, so check who's asking every time.
  const user = await getCurrentUser();
  if (!isCarOwner(user.ridePreference)) {
    return { error: "Only car owners can add stops here." };
  }
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { error: "Give the stop a name people know, like a landmark." };
  }

  let point: { lat: number; lng: number } | null = null;
  if (Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    point = { lat: Number(input.lat), lng: Number(input.lng) };
  } else if (input.link?.trim()) {
    point = (await resolveLocation(input.link)).point;
  }
  if (!point) return { error: NO_POSITION };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("owner_add_place", {
      p_name: name,
      p_lat: point.lat,
      p_lng: point.lng,
    })
    .maybeSingle();
  if (error || !data) {
    return {
      error:
        error?.hint === "TOO_FAR"
          ? "That's far from every other stop. Check the link points at the right place."
          : error?.hint === "TOO_MANY"
            ? "That's 10 new stops today, thank you! Add more tomorrow."
            : "Couldn't add the stop. Please try again.",
    };
  }
  return {
    place: {
      id: data.place_id,
      name: data.place_name,
      lat: data.lat,
      lng: data.lng,
    },
    created: data.created,
  };
}
