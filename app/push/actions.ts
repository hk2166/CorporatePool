"use server";

import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type BrowserSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function valid(s: BrowserSubscription): boolean {
  return (
    typeof s.endpoint === "string" &&
    s.endpoint.startsWith("https://") &&
    s.endpoint.length <= 1000 &&
    typeof s.p256dh === "string" &&
    s.p256dh.length >= 40 &&
    s.p256dh.length <= 200 &&
    typeof s.auth === "string" &&
    s.auth.length >= 16 &&
    s.auth.length <= 64
  );
}

// Remembers this browser for the signed-in person (F-E1). A browser belongs to whoever
// subscribed it last, so a shared phone doesn't get someone else's notifications.
export async function savePushSubscription(
  subscription: BrowserSubscription,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!valid(subscription)) return { ok: false };
  const { error } = await createAdminClient().from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      user_id: user.id,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

// Forgets this browser (the person turned notifications off).
export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  return { ok: !error };
}
