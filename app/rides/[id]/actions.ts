"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type RideActionState = { error?: string; saved?: boolean };

// Cancels one of the owner's rides (F-B4, user flow 7). cancel_ride() does the work in one
// transaction: bookings cancelled, riders notified, "any car" riders flagged for re-matching.
export async function cancelRide(
  _previous: RideActionState,
  formData: FormData,
): Promise<RideActionState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();
  const { error } = await createAdminClient().rpc("cancel_ride", {
    p_owner_id: user.id,
    p_ride_id: String(formData.get("rideId") ?? ""),
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) {
    return {
      error:
        error.hint === "NOT_CANCELLABLE"
          ? "This ride can no longer be cancelled."
          : "Couldn't cancel the ride. Please try again.",
    };
  }
  redirect("/");
}

// Updates the notes riders see on one of the owner's rides.
export async function saveRideNotes(
  _previous: RideActionState,
  formData: FormData,
): Promise<RideActionState> {
  const user = await getCurrentUser();
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 280)
    return { error: "Notes can be at most 280 characters." };

  // Rides are written by the server only (T-1.3); the owner check is the .eq below.
  const { data, error } = await createAdminClient()
    .from("rides")
    .update({ notes: notes || null })
    .eq("id", String(formData.get("rideId") ?? ""))
    .eq("owner_id", user.id)
    .in("status", ["OPEN", "ALLOCATING", "FULL"])
    .select("id");
  if (error || !data?.length) {
    return { error: "Couldn't save the notes. Please try again." };
  }
  refresh();
  return { saved: true };
}
