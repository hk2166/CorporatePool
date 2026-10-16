"use server";

import { refresh } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ModerationState = { error?: string; done?: boolean };

// A ban long enough to be permanent; restoring lifts it.
const BAN_FOREVER = "876000h";

function reasonOf(formData: FormData): string | null {
  const reason = String(formData.get("reason") ?? "").trim();
  return reason.length >= 3 && reason.length <= 500 ? reason : null;
}

const NEED_REASON =
  "Give a reason (3 to 500 characters): it goes in the audit trail.";

// Every action here is an admin's, recorded in admin_actions with its reason (F-G4). The
// database functions check the admin again.

export async function closeReport(
  _previous: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await getCurrentAdmin();
  const reason = reasonOf(formData);
  if (!reason) return { error: NEED_REASON };
  const { error } = await createAdminClient().rpc("admin_close_report", {
    p_admin_id: admin.id,
    p_report_id: String(formData.get("reportId") ?? ""),
    p_resolved: formData.get("outcome") === "resolved",
    p_reason: reason,
  });
  if (error) return { error: "Couldn't close the report." };
  refresh();
  return { done: true };
}

// Removes a member: marked removed, seats and rides still to come cancelled, sign-in banned.
export async function removeMember(
  _previous: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await getCurrentAdmin();
  const reason = reasonOf(formData);
  if (!reason) return { error: NEED_REASON };
  const userId = String(formData.get("userId") ?? "");
  const client = createAdminClient();
  const { error } = await client.rpc("admin_remove_user", {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) {
    return {
      error:
        error.hint === "SELF"
          ? "You can't remove yourself."
          : "Couldn't remove them. They may already be removed.",
    };
  }
  await client.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
  // Their riders who'd take any car are found another one now, not at the next run.
  await client.rpc("run_rematch");
  refresh();
  return { done: true };
}

export async function restoreMember(
  _previous: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await getCurrentAdmin();
  const reason = reasonOf(formData);
  if (!reason) return { error: NEED_REASON };
  const userId = String(formData.get("userId") ?? "");
  const client = createAdminClient();
  const { error } = await client.rpc("admin_restore_user", {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) return { error: "Couldn't restore them." };
  await client.auth.admin.updateUserById(userId, { ban_duration: "none" });
  refresh();
  return { done: true };
}

export async function setRideHidden(
  _previous: ModerationState,
  formData: FormData,
): Promise<ModerationState> {
  const admin = await getCurrentAdmin();
  const reason = reasonOf(formData);
  if (!reason) return { error: NEED_REASON };
  const { error } = await createAdminClient().rpc("admin_set_ride_hidden", {
    p_admin_id: admin.id,
    p_ride_id: String(formData.get("rideId") ?? ""),
    p_hidden: formData.get("hidden") === "true",
    p_reason: reason,
  });
  if (error) return { error: "Couldn't change the ride." };
  refresh();
  return { done: true };
}
