"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = { error?: string; link?: string; summary?: string };

// Creates an invite link for the WhatsApp group (Q3, F-G6): one person, or many, for a few
// days. Invites are written by the server only (T-1.3), recording which admin made them.
export async function createInvite(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await getCurrentAdmin();
  const uses = Number(formData.get("uses"));
  const days = Number(formData.get("days"));
  if (!Number.isInteger(uses) || uses < 1 || uses > 1000) {
    return { error: "Between 1 and 1,000 people." };
  }
  if (!Number.isInteger(days) || days < 1 || days > 60) {
    return { error: "Between 1 and 60 days." };
  }
  // 18 random bytes = 24 base64url characters, about 144 bits: impossible to guess.
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { error } = await createAdminClient().from("signup_tokens").insert({
    token,
    created_by: admin.id,
    max_uses: uses,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return { error: "Couldn't create the invite." };
  refresh();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    link: `${site}/invite/${token}`,
    summary: `${uses === 1 ? "One person" : `Up to ${uses} people`}, for ${days} ${days === 1 ? "day" : "days"}.`,
  };
}

// Stops an invite working straight away.
export async function endInvite(formData: FormData): Promise<void> {
  await getCurrentAdmin();
  await createAdminClient()
    .from("signup_tokens")
    .update({ expires_at: new Date().toISOString() })
    .eq("token", String(formData.get("token") ?? ""))
    .gt("expires_at", new Date().toISOString());
  refresh();
}
