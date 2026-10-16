"use server";

import { refresh } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type DecisionState = { error?: string };

// Accepts (makes them a member) or rejects someone who asked to join. The database checks the
// admin again.
export async function decideJoinRequest(
  _previous: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const admin = await getCurrentAdmin();
  const accept = formData.get("decision") === "accept";
  const { error } = await createAdminClient().rpc("admin_decide_join_request", {
    p_admin_id: admin.id,
    p_user_id: String(formData.get("userId") ?? ""),
    p_accept: accept,
  });
  if (error) {
    return {
      error:
        error.hint === "ACCEPTED"
          ? "They're already a member. To take them out, remove them under Reports."
          : "Couldn't save that. Please try again.",
    };
  }
  refresh();
  return {};
}
