"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addDays, indiaDate } from "@/lib/india-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDepartTime } from "@/lib/usual-ride";

export type GoLiveState = { error?: string; rideId?: string };

// The one evening tap (F-B2): puts the owner's usual ride up for today or tomorrow, optionally
// with a different time or number of seats for that day.
export async function goLive(
  _previous: GoLiveState,
  formData: FormData,
): Promise<GoLiveState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();

  const today = indiaDate();
  const day = String(formData.get("day") ?? "");
  if (day !== today && day !== addDays(today, 1)) {
    return { error: "You can go live for today or tomorrow." };
  }

  const timeInput = String(formData.get("departTime") ?? "");
  const departTime = timeInput ? parseDepartTime(timeInput) : null;
  if (timeInput && !departTime) return { error: "Pick a valid time." };

  const seatsInput = String(formData.get("seats") ?? "");
  const seats = seatsInput ? Number(seatsInput) : null;

  // go_live() enforces the rules (the owner's own usual ride, seats within the car, a time
  // that hasn't passed, a phone number) and never creates two rides for one day. Only the
  // server may call it.
  const { data, error } = await createAdminClient()
    .rpc("go_live", {
      p_owner_id: user.id,
      p_usual_ride_id: String(formData.get("usualRideId") ?? ""),
      p_date: day,
      ...(departTime ? { p_depart_time: departTime } : {}),
      ...(seats ? { p_seats: seats } : {}),
    })
    .single();

  if (error) {
    const messages: Record<string, string> = {
      NO_PHONE: "Add your phone number in your profile first.",
      BAD_SEATS: error.message,
      IN_PAST: "That time has already passed. Pick tomorrow or a later time.",
    };
    return {
      error:
        (error.hint && messages[error.hint]) ??
        "Couldn't go live. Please try again.",
    };
  }

  refresh();
  return { rideId: data.ride_id };
}
