"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { inviteEndsAt, inviteName, NO_LIMIT } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = {
  error?: string;
  link?: string;
  summary?: string;
  values?: {
    name: string;
    uses: string;
    noLimit: boolean;
    duration: string;
    until: string;
  };
};

// Creates an invite link for the WhatsApp group (Q3, F-G6): a random one nobody can guess, or
// one with a name people can read (/invite/palwal-gurgaon); for a number of people or anyone;
// open for a preset time or until a chosen moment. Invites are written by the server only
// (T-1.3), recording which admin made them.
export async function createInvite(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await getCurrentAdmin();
  const nameText = String(formData.get("name") ?? "").trim();
  const noLimit = formData.get("noLimit") === "on";
  const usesText = String(formData.get("uses") ?? "");
  const duration = String(formData.get("duration") ?? "7d");
  const until = String(formData.get("until") ?? "");
  const values = { name: nameText, uses: usesText, noLimit, duration, until };

  const name = nameText ? inviteName(nameText) : null;
  if (nameText && !name) {
    return {
      error:
        "A link name is 4 to 40 letters, numbers and hyphens, like palwal-gurgaon.",
      values,
    };
  }
  const uses = noLimit ? NO_LIMIT : Number(usesText);
  if (!Number.isInteger(uses) || uses < 1 || uses > NO_LIMIT) {
    return { error: "Between 1 and 10,000 people, or no limit.", values };
  }
  const endsAt = inviteEndsAt(duration, until);
  if (!endsAt) {
    return {
      error: "Pick when the link ends: in the future, within 60 days.",
      values,
    };
  }

  const db = createAdminClient();
  // 18 random bytes = 24 base64url characters, about 144 bits: impossible to guess.
  const token = name ?? randomBytes(18).toString("base64url");
  if (name) {
    // A name can be used again once its old link has ended or filled up.
    const { data: old } = await db
      .from("signup_tokens")
      .select("used_count, max_uses, expires_at")
      .eq("token", name)
      .maybeSingle();
    if (old) {
      const over =
        new Date(old.expires_at) <= new Date() ||
        old.used_count >= old.max_uses;
      if (!over) {
        return {
          error: `/invite/${name} is still open. End it first, or pick another name.`,
          values,
        };
      }
      await db.from("signup_tokens").delete().eq("token", name);
    }
  }
  const { error } = await db.from("signup_tokens").insert({
    token,
    created_by: admin.id,
    max_uses: uses,
    expires_at: endsAt.toISOString(),
  });
  if (error) return { error: "Couldn't create the invite.", values };
  refresh();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const who =
    uses === NO_LIMIT
      ? "Anyone with the link"
      : uses === 1
        ? "One person"
        : `Up to ${uses} people`;
  return {
    link: `${site}/invite/${token}`,
    summary: `${who} can join until ${dayLabel(indiaDate(endsAt))} ${indiaTime(endsAt)}.`,
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
