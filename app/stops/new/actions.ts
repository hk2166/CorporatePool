"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveLocation } from "@/lib/resolve-location";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export type AddStopState = {
  error?: string;
  values?: { name: string; location: string };
};

const NO_POSITION =
  "Couldn't find a position in that. In Google Maps, press and hold the spot to drop a pin, tap Share, then Copy link, and paste that link here.";

// A stop that isn't in the list yet. Members ask for it (an admin adds it); admins add it
// straight away. Where it is comes as a Google Maps link (short ones are followed) or
// coordinates: optional for members, needed for admins. Then back to the page they came from.
export async function addStop(
  _previous: AddStopState,
  formData: FormData,
): Promise<AddStopState> {
  const user = await getCurrentUser();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const values = { name, location };
  if (name.length < 2 || name.length > 80) {
    return {
      error: "Give the stop a name people know, like a landmark.",
      values,
    };
  }

  const { point, link } = await resolveLocation(location);
  // Something was pasted, but it's neither a position nor a link to keep.
  if (location && !point && !link) return { error: NO_POSITION, values };

  const next = new URL(
    safeNextPath(String(formData.get("next") ?? "")),
    "http://x",
  );
  const supabase = await createClient();

  if (user.isAdmin) {
    if (!point) return { error: NO_POSITION, values };
    const { data: id, error } = await supabase.rpc("admin_save_place", {
      p_id: null as unknown as string,
      p_name: name,
      p_kind: "landmark",
      p_lat: point.lat,
      p_lng: point.lng,
    });
    if (error || !id) {
      return {
        error:
          error?.code === "23505"
            ? `There's already a stop called “${name}”: pick it from the list.`
            : "Couldn't add the stop. Please try again.",
        values,
      };
    }
    next.searchParams.set("stop", id);
    next.searchParams.set("stopAdded", "new");
    redirect(next.pathname + next.search);
  }

  const { error } = await supabase.rpc("request_stop", {
    p_name: name,
    p_lat: point?.lat,
    p_lng: point?.lng,
    p_link: link ?? undefined,
  });
  if (error) {
    return {
      error:
        error.hint === "EXISTS"
          ? `There's already a stop called “${name}”: pick it from the list.`
          : error.hint === "TOO_MANY"
            ? "That's 10 requests today, thank you! Ask for more tomorrow."
            : "Couldn't send the request. Please try again.",
      values,
    };
  }
  next.searchParams.set("stopRequested", "1");
  redirect(next.pathname + next.search);
}
