import { describe, expect, it } from "vitest";
import { notificationText } from "@/lib/notification-text";

describe("ride_on_route", () => {
  it("names the car's way, stops, time, seats and price", () => {
    const n = notificationText(
      "ride_on_route",
      {
        ride_id: "r1",
        direction: "MORNING",
        from: "Agra Chowk",
        to: "Shankar Chowk (Shyam Chowk)",
        seats_left: 3,
        price: 110,
      },
      "2026-10-18T02:45:00Z",
    );
    expect(n.title).toBe("A car to the office on your route");
    expect(n.body).toBe(
      "Agra Chowk → Shankar Chowk (Shyam Chowk), Sun, 18 Oct 08:15 · 3 seats left · ₹110. Tap to ask for a seat.",
    );
    expect(n.url).toBe("/rides/r1");
  });

  it("says when the car is going home", () => {
    expect(
      notificationText("ride_on_route", {
        ride_id: "r2",
        direction: "EVENING",
        seats_left: 1,
      }).title,
    ).toBe("A car home on your route");
  });
});

describe("route_digest", () => {
  it("counts tomorrow's cars each way and opens the morning search", () => {
    const n = notificationText("route_digest", {
      date: "2026-10-18",
      morning: 2,
      evening: 1,
      home: "h",
      work: "w",
    });
    expect(n.title).toBe("3 cars tomorrow on your route");
    expect(n.body).toBe("2 to the office, 1 home. Tap to see them.");
    expect(n.url).toBe("/search?from=h&to=w&date=2026-10-18");
  });

  it("opens the evening search when only cars home are coming", () => {
    const n = notificationText("route_digest", {
      date: "2026-10-18",
      morning: 0,
      evening: 1,
      home: "h",
      work: "w",
    });
    expect(n.title).toBe("1 car tomorrow on your route");
    expect(n.body).toBe("1 home. Tap to see them.");
    expect(n.url).toBe("/search?from=w&to=h&date=2026-10-18");
  });
});
