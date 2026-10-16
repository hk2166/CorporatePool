import webpush from "web-push";
import { isCronRequest } from "@/lib/jobs/cron-auth";
import {
  deliver,
  type Claimed,
  type PushSubscription,
} from "@/lib/push-sender";
import { createAdminClient } from "@/lib/supabase/admin";

// The push sender (T-6.3, lld.md §6). The database calls this right after it writes
// notifications and every minute while any wait (supabase/migrations/*_push_sender.sql). It
// claims batches from the outbox, sends them with Web Push, and reports back; anything it
// doesn't report back is retried, so a crash here loses nothing.

const BATCH = 50;
// Stay well inside a serverless function's time limit; what's left goes on the next call.
const TIME_BUDGET_MS = 8000;

export async function POST(request: Request) {
  if (!isCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return new Response("Web Push keys aren't set", { status: 503 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://github.com/hk2166/CorporatePool",
    publicKey,
    privateKey,
  );

  const admin = createAdminClient();
  const started = Date.now();
  let sent = 0;
  let failed = 0;

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: batch, error } = await admin.rpc("claim_notifications", {
      p_limit: BATCH,
    });
    if (error)
      return new Response("Couldn't claim notifications", { status: 500 });
    if (!batch.length) break;

    const result = await deliver(batch as Claimed[], {
      async subscriptionsFor(userIds) {
        const { data } = await admin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth")
          .in("user_id", userIds);
        const byUser = new Map<string, PushSubscription[]>();
        for (const s of data ?? []) {
          byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
        }
        return byUser;
      },
      async departures(rideIds) {
        if (!rideIds.length) return new Map();
        const { data } = await admin
          .from("rides")
          .select("id, depart_at")
          .in("id", rideIds);
        return new Map((data ?? []).map((r) => [r.id, r.depart_at]));
      },
      async send(subscription, message) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            message,
            { TTL: 60 * 60, urgency: "high" },
          );
          return "ok";
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          return status === 404 || status === 410 ? "gone" : "error";
        }
      },
      async forget(endpoints) {
        await admin
          .from("push_subscriptions")
          .delete()
          .in("endpoint", endpoints);
      },
    });

    await admin.rpc("finish_notifications", {
      p_sent: result.sent,
      p_failed: result.failed,
    });
    sent += result.sent.length;
    failed += result.failed.length;
    if (batch.length < BATCH) break;
  }

  return Response.json({ sent, failed });
}
