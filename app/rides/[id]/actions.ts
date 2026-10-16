"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type RideActionState = { error?: string; saved?: boolean };

// Cancels one of the owner's rides (F-B4, user flow 7). cancel_ride() does the work in one
// transaction: bookings cancelled, riders notified, "any car" riders flagged for re-matching;
// run_rematch() then moves those riders into other cars.
export async function cancelRide(
  _previous: RideActionState,
  formData: FormData,
): Promise<RideActionState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_ride", {
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
  // Find the "any car" riders another car straight away rather than at the next 5-minute run
  // (T-5.4, user flow 7). If this fails, that run picks them up.
  await admin.rpc("run_rematch");
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

// The morning of the ride (F-B8, user flow 3 step 5): start, mark each rider, complete. The
// database functions check the ride is the owner's and in the right state (T-5.6).
const RIDE_DAY_ERRORS: Record<string, string> = {
  TOO_EARLY: "You can start the ride from an hour before it leaves.",
  NOT_STARTABLE: "This ride can't be started.",
  NOT_STARTED: "Start the ride first.",
  NOT_ON_RIDE: "This rider isn't on the ride.",
  PICKED_UP: "This rider was picked up. Undo that first.",
  IS_NO_SHOW: "Undo the no-show first.",
};

async function rideDay(
  fn: "start_ride" | "complete_ride",
  formData: FormData,
): Promise<RideActionState> {
  const user = await getCurrentUser();
  const { error } = await createAdminClient().rpc(fn, {
    p_owner_id: user.id,
    p_ride_id: String(formData.get("rideId") ?? ""),
  });
  if (error) {
    return {
      error:
        (error.hint && RIDE_DAY_ERRORS[error.hint]) ??
        "That didn't work. Please try again.",
    };
  }
  refresh();
  return {};
}

export async function startRide(
  _previous: RideActionState,
  formData: FormData,
): Promise<RideActionState> {
  return rideDay("start_ride", formData);
}

export async function completeRide(
  _previous: RideActionState,
  formData: FormData,
): Promise<RideActionState> {
  return rideDay("complete_ride", formData);
}

// Picked up, no-show (costs the rider 15 points), or undo for a wrong tap.
export async function markRider(
  _previous: RideActionState,
  formData: FormData,
): Promise<RideActionState> {
  const user = await getCurrentUser();
  const outcome = String(formData.get("outcome") ?? "");
  if (!["picked_up", "no_show", "undo"].includes(outcome)) {
    return { error: "That didn't work. Please try again." };
  }
  const { error } = await createAdminClient().rpc("mark_rider", {
    p_owner_id: user.id,
    p_booking_id: String(formData.get("bookingId") ?? ""),
    p_outcome: outcome,
  });
  if (error) {
    return {
      error:
        (error.hint && RIDE_DAY_ERRORS[error.hint]) ??
        "That didn't work. Please try again.",
    };
  }
  refresh();
  return {};
}
