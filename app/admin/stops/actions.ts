"use server";

import { refresh } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { parseCoordinates } from "@/lib/coordinates";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type StopState = { error?: string; done?: string };

type PlaceKind = Database["public"]["Enums"]["place_kind"];
const KINDS: PlaceKind[] = ["landmark", "metro", "office", "town"];

// Adds a stop, or changes one (F-G6). As the signed-in admin; the database checks.
export async function saveStop(
  _previous: StopState,
  formData: FormData,
): Promise<StopState> {
  await getCurrentAdmin();
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "landmark") as PlaceKind;
  const point = parseCoordinates(String(formData.get("coordinates") ?? ""));
  if (name.length < 2 || name.length > 80) {
    return { error: "A name of 2 to 80 characters." };
  }
  if (!KINDS.includes(kind)) return { error: "Pick what kind of stop it is." };
  if (!point) {
    return {
      error: 'Paste the coordinates from Google Maps, like "28.1440, 77.3290".',
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_place", {
    p_id: id as string,
    p_name: name,
    p_kind: kind,
    p_lat: point.lat,
    p_lng: point.lng,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "There's already a stop with that name."
          : "Couldn't save the stop.",
    };
  }
  refresh();
  return { done: id ? "Saved." : `Added ${name}.` };
}

// Deletes a stop nobody should use. Members' home and work stops pointing at it are cleared,
// and rides keep the name and place they had.
export async function deleteStop(
  _previous: StopState,
  formData: FormData,
): Promise<StopState> {
  await getCurrentAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("places")
    .delete()
    .eq("id", String(formData.get("id") ?? ""));
  if (error) return { error: "Couldn't delete the stop." };
  refresh();
  return { done: "Deleted." };
}

// Merges a duplicate into the stop to keep (the database re-points everything).
export async function mergeStops(
  _previous: StopState,
  formData: FormData,
): Promise<StopState> {
  await getCurrentAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_merge_places", {
    p_from: String(formData.get("from") ?? ""),
    p_into: String(formData.get("into") ?? ""),
  });
  if (error) {
    return {
      error:
        error.hint === "BAD_MERGE"
          ? "Pick two different stops."
          : "Couldn't merge the stops.",
    };
  }
  refresh();
  return { done: `Merged. ${data} references moved.` };
}
