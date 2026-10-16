"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { addDays, indiaDate } from "@/lib/india-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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

// "Skip tomorrow" for owners with automatic go-live (F-B3), before the 17:00 job has run.
// After it has run, skipping is cancelling the ride (app/rides/[id]), which tells riders.
export async function setDaySkipped(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const usualRideId = String(formData.get("usualRideId") ?? "");
  const day = String(formData.get("day") ?? "");
  const skip = formData.get("skip") === "1";
  if (day <= indiaDate()) return;

  // As the owner: the usual ride is only visible to them (T-1.3), so this is the owner check.
  const supabase = await createClient();
  const { data: usual } = await supabase
    .from("usual_rides")
    .select("id")
    .eq("id", usualRideId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!usual) return;

  // Skips are written by the server only.
  const skips = createAdminClient().from("usual_ride_skips");
  if (skip) {
    await skips.upsert(
      { usual_ride_id: usual.id, day },
      { onConflict: "usual_ride_id,day", ignoreDuplicates: true },
    );
  } else {
    await skips.delete().eq("usual_ride_id", usual.id).eq("day", day);
  }
  refresh();
}
