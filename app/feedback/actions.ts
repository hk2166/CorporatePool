"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FeedbackState = {
  error?: string;
  sent?: number; // when the last one went, so the form can start fresh
  values?: { kind: string; title: string; details: string };
};

// Sends an idea or a problem. The member's own upvote comes with it.
export async function sendFeedback(
  _previous: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  await getCurrentUser();
  const kind = formData.get("kind") === "PROBLEM" ? "PROBLEM" : "IDEA";
  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const values = { kind, title, details };
  if (title.length < 3 || title.length > 120) {
    return { error: "Say it in 3 to 120 characters.", values };
  }
  if (details.length > 1000) {
    return { error: "Keep the details under 1,000 characters.", values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_feedback", {
    p_kind: kind,
    p_title: title,
    p_details: details || undefined,
  });
  if (error) {
    return {
      error:
        error.hint === "TOO_MANY"
          ? "That's 10 today, thank you! Send more tomorrow."
          : "Couldn't send it. Please try again.",
      values,
    };
  }
  refresh();
  return { sent: Date.now() };
}

// An upvote, or taking it back.
export async function voteFeedback(id: string, vote: boolean): Promise<void> {
  await getCurrentUser();
  const supabase = await createClient();
  await supabase.rpc("vote_feedback", { p_feedback_id: id, p_vote: vote });
  refresh();
}
