import { describe, expect, it } from "vitest";
import { notificationText } from "@/lib/notification-text";
import {
  deliver,
  type Claimed,
  type PushSubscription,
  type SendResult,
  type SenderDeps,
} from "@/lib/push-sender";

const ride = "5eed0000-0000-0000-0000-0000000000d1";
// 08:00 in India on Sat 17 Oct 2026
const departAt = "2026-10-17T02:30:00+00:00";

const sub = (name: string): PushSubscription => ({
  endpoint: `https://push.example.com/${name}`,
  p256dh: "key",
  auth: "secret",
});

function deps(
  subscriptions: Record<string, PushSubscription[]>,
  results: Record<string, SendResult> = {},
): SenderDeps & { sentTo: string[]; forgotten: string[] } {
  const sentTo: string[] = [];
  const forgotten: string[] = [];
  return {
    sentTo,
    forgotten,
    subscriptionsFor: async () => new Map(Object.entries(subscriptions)),
    departures: async () => new Map([[ride, departAt]]),
    send: async (s, message) => {
      sentTo.push(`${s.endpoint} ${JSON.parse(message).title}`);
      return results[s.endpoint] ?? "ok";
    },
    forget: async (endpoints) => {
      forgotten.push(...endpoints);
    },
  };
}

const n = (id: string, user: string, kind = "booking_confirmed"): Claimed => ({
  id,
  user_id: user,
  kind,
  payload: { ride_id: ride },
});

describe("deliver", () => {
  it("sends each notification to every browser of its person", async () => {
    const d = deps({ u1: [sub("phone"), sub("laptop")] });
    expect(await deliver([n("1", "u1")], d)).toEqual({
      sent: ["1"],
      failed: [],
    });
    expect(d.sentTo).toEqual([
      "https://push.example.com/phone Seat confirmed",
      "https://push.example.com/laptop Seat confirmed",
    ]);
  });

  it("counts a person with no browsers as done", async () => {
    const d = deps({});
    expect(await deliver([n("1", "u1")], d)).toEqual({
      sent: ["1"],
      failed: [],
    });
    expect(d.sentTo).toEqual([]);
  });

  it("retries a notification no browser accepted", async () => {
    const d = deps(
      { u1: [sub("phone")] },
      { "https://push.example.com/phone": "error" },
    );
    expect(await deliver([n("1", "u1")], d)).toEqual({
      sent: [],
      failed: ["1"],
    });
  });

  it("is done when one browser got it, even if another failed", async () => {
    const d = deps(
      { u1: [sub("phone"), sub("laptop")] },
      { "https://push.example.com/laptop": "error" },
    );
    expect(await deliver([n("1", "u1")], d)).toEqual({
      sent: ["1"],
      failed: [],
    });
  });

  it("forgets browsers that unsubscribed, once, and stops sending to them", async () => {
    const d = deps(
      { u1: [sub("old"), sub("phone")] },
      { "https://push.example.com/old": "gone" },
    );
    const result = await deliver([n("1", "u1"), n("2", "u1", "ride_full")], d);
    expect(result).toEqual({ sent: ["1", "2"], failed: [] });
    expect(d.forgotten).toEqual(["https://push.example.com/old"]);
    expect(d.sentTo.filter((s) => s.includes("/old"))).toHaveLength(1);
  });
});

describe("notificationText", () => {
  it("tells the owner who booked, from where to where, and how many so far", () => {
    const text = notificationText(
      "rider_booked",
      {
        ride_id: "r1",
        rider: "Priya",
        from: "Agra Chowk",
        to: "Cyber City",
        status: "REQUESTED",
        riders: 3,
      },
      "2026-10-19T02:30:00Z",
    );
    expect(text.title).toBe("Priya asked for a seat");
    expect(text.body).toBe(
      "Agra Chowk → Cyber City, Mon, 19 Oct 08:00. 3 riders so far.",
    );
    expect(text.url).toBe("/my-riders");
    expect(
      notificationText("rider_booked", { status: "CONFIRMED", riders: 1 })
        .title,
    ).toBe("A rider booked a seat");
  });

  it("reminds a rider of their stop and time", () => {
    expect(
      notificationText(
        "reminder",
        {
          ride_id: ride,
          stop: "Demo Stop 09",
          pickup_at: "2026-10-17T03:05:00+00:00",
        },
        departAt,
      ).body,
    ).toBe("Demo Stop 09 at 08:35.");
  });

  it("says what happened, when, and links to the ride", () => {
    expect(
      notificationText("booking_confirmed", { ride_id: ride }, departAt),
    ).toEqual({
      title: "Seat confirmed",
      body: "Sat, 17 Oct 08:00. Tap for the car and the owner's number.",
      url: `/rides/${ride}`,
    });
  });

  it("gives the waitlist place", () => {
    expect(
      notificationText(
        "booking_waitlisted",
        { ride_id: ride, rank: 2 },
        departAt,
      ).title,
    ).toBe("Waitlisted #2");
  });

  it("passes on the owner's reason for cancelling", () => {
    expect(
      notificationText(
        "ride_cancelled",
        {
          ride_id: ride,
          reason: "Car at the service centre",
          finding_another_car: true,
        },
        departAt,
      ).body,
    ).toBe(
      'The owner cancelled the ride for Sat, 17 Oct 08:00. "Car at the service centre" We\'re looking for another car for you.',
    );
  });

  it("has words for every kind the database writes", () => {
    const kinds = [
      "booking_confirmed",
      "booking_promoted",
      "booking_moved",
      "booking_waitlisted",
      "request_withdrawn",
      "ride_cancelled",
      "booking_expired",
      "ride_started",
      "marked_no_show",
      "ride_completed",
      "reminder",
      "ride_full",
      "rider_booked",
      "booking_cancelled",
      "ride_auto_live",
    ];
    for (const kind of kinds) {
      expect(
        notificationText(kind, { ride_id: ride }, departAt).title,
      ).not.toBe("CorporatePool");
    }
  });
});
