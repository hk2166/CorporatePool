// The push sender's logic (T-6.3, lld.md §6): turn a batch of claimed outbox rows into Web
// Push messages and say which were sent. The I/O (database, web-push) is passed in, so this
// can be tested without either; app/api/push/send wires in the real thing.

import { notificationText } from "@/lib/notification-text";

export type Claimed = {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
};

export type PushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// What happened to one message on one browser. "gone" means the browser unsubscribed (the
// push service answered 404 or 410), so that subscription should be forgotten.
export type SendResult = "ok" | "gone" | "error";

export type SenderDeps = {
  subscriptionsFor(userIds: string[]): Promise<Map<string, PushSubscription[]>>;
  departures(rideIds: string[]): Promise<Map<string, string>>;
  send(subscription: PushSubscription, message: string): Promise<SendResult>;
  forget(endpoints: string[]): Promise<void>;
};

export async function deliver(
  batch: Claimed[],
  deps: SenderDeps,
): Promise<{ sent: string[]; failed: string[] }> {
  const userIds = [...new Set(batch.map((n) => n.user_id))];
  const rideIds = [
    ...new Set(
      batch
        .map((n) => n.payload.ride_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const [subscriptions, departures] = await Promise.all([
    deps.subscriptionsFor(userIds),
    deps.departures(rideIds),
  ]);

  const sent: string[] = [];
  const failed: string[] = [];
  const gone = new Set<string>();

  for (const n of batch) {
    const targets = (subscriptions.get(n.user_id) ?? []).filter(
      (s) => !gone.has(s.endpoint),
    );
    // Nobody to send to (no browser allowed notifications): push is a convenience, and the
    // app shows the same thing next time it's opened, so this one is done.
    if (targets.length === 0) {
      sent.push(n.id);
      continue;
    }
    const rideId =
      typeof n.payload.ride_id === "string" ? n.payload.ride_id : undefined;
    const text = notificationText(
      n.kind,
      n.payload,
      rideId ? departures.get(rideId) : undefined,
    );
    // One notification per ride and kind on a device, so repeats replace each other.
    const message = JSON.stringify({
      ...text,
      tag: `${n.kind}:${rideId ?? n.id}`,
    });

    const results = await Promise.all(
      targets.map(
        async (s) => [s.endpoint, await deps.send(s, message)] as const,
      ),
    );
    for (const [endpoint, result] of results) {
      if (result === "gone") gone.add(endpoint);
    }
    // Delivered to at least one browser, or every browser has gone away: done. Otherwise
    // (all errors), try again on the next run.
    if (
      results.some(([, r]) => r === "ok") ||
      results.every(([, r]) => r === "gone")
    ) {
      sent.push(n.id);
    } else {
      failed.push(n.id);
    }
  }

  if (gone.size > 0) await deps.forget([...gone]);
  return { sent, failed };
}
