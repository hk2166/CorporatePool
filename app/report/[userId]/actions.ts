"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ReportState = { error?: string; done?: "reported" | "blocked" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reports someone to the admins (F-F8, F-G4). Written as the signed-in person, under the access
// rules: a report is always in your own name.
export async function reportUser(
  _previous: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await getCurrentUser();
  const aboutUser = String(formData.get("aboutUser") ?? "");
  const rideId = String(formData.get("rideId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(aboutUser) || aboutUser === user.id) {
    return { error: "You can't report this person." };
  }
  if (reason.length < 5 || reason.length > 1000) {
    return {
      error: "Say what happened in a few words (up to 1,000 characters).",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    by_user: user.id,
    about_user: aboutUser,
    ride_id: UUID.test(rideId) ? rideId : null,
    reason,
  });
  if (error) return { error: "Couldn't send the report. Please try again." };
  return { done: "reported" };
}

// Blocks someone: you'll never be matched again, and any seat between you on a ride still to
// come ends (the database does that, T-6.5).
export async function blockUser(
  _previous: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await getCurrentUser();
  const blocked = String(formData.get("aboutUser") ?? "");
  if (!UUID.test(blocked) || blocked === user.id) {
    return { error: "You can't block this person." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocks")
    .upsert(
      { blocker_id: user.id, blocked_id: blocked },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  if (error) return { error: "Couldn't block. Please try again." };
  refresh();
  return { done: "blocked" };
}

// Unblocks someone (from the profile page).
export async function unblockUser(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const blocked = String(formData.get("blockedId") ?? "");
  if (!UUID.test(blocked)) return;
  const supabase = await createClient();
  await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blocked);
  refresh();
}
