"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { parseRidePreference } from "@/lib/ride-preference";
import { createClient } from "@/lib/supabase/server";

export type PreferenceState = { error?: string; saved?: number };

// Saves how the member mostly uses the app. From /welcome it carries on with sign-up (the
// phone number, if it's missing); from the profile page it stays put.
export async function setRidePreference(
  _previous: PreferenceState,
  formData: FormData,
): Promise<PreferenceState> {
  const user = await getCurrentUser();
  const preference = parseRidePreference(formData.get("preference"));
  if (!preference) return { error: "Pick one of the three." };

  // As the signed-in person: the access rules only let them change their own row.
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ ride_preference: preference })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save that. Please try again." };

  if (formData.get("next") === "onboarding") {
    redirect(user.hasPhone ? "/" : "/profile?welcome=1");
  }
  refresh();
  return { saved: Date.now() };
}
