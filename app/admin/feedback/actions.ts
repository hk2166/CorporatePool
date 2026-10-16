"use server";

import { refresh } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeedbackUpdateState = { error?: string; saved?: number };

// Marks an item open, planned, done or not planned, with an optional reply members see. The
// database checks the admin again.
export async function updateFeedback(
  _previous: FeedbackUpdateState,
  formData: FormData,
): Promise<FeedbackUpdateState> {
  const admin = await getCurrentAdmin();
  const reply = String(formData.get("reply") ?? "").trim();
  if (reply.length > 500) {
    return { error: "Keep the reply under 500 characters." };
  }
  const { error } = await createAdminClient().rpc("admin_update_feedback", {
    p_admin_id: admin.id,
    p_feedback_id: String(formData.get("feedbackId") ?? ""),
    p_status: String(formData.get("status") ?? ""),
    p_reply: reply || undefined,
  });
  if (error) return { error: "Couldn't save that. Please try again." };
  refresh();
  return { saved: Date.now() };
}
