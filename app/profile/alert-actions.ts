"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseRideAlerts } from "@/lib/ride-alerts";
import { createClient } from "@/lib/supabase/server";

export type AlertsState = { error?: string; saved?: number };

// Saves how the member hears about cars on their route.
export async function setRideAlerts(
  _previous: AlertsState,
  formData: FormData,
): Promise<AlertsState> {
  const user = await getCurrentUser();
  const alerts = parseRideAlerts(formData.get("alerts"));
  // As the signed-in person: the access rules only let them change their own row.
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ ride_alerts: alerts })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save that. Please try again." };
  refresh();
  return { saved: Date.now() };
}
