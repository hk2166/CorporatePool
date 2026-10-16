import { describe, expect, it } from "vitest";
import {
  cardLine,
  routeSummary,
  seatsSummary,
  shareMessage,
  type PublicRide,
} from "@/lib/ride-card";

const ride: PublicRide = {
  ride_id: "5eed0000-0000-0000-0000-0000000000d1",
  // 08:00 in India on Sat 17 Oct 2026
  depart_at: "2026-10-17T02:30:00+00:00",
  price_per_seat: 150,
  seats_left: 2,
  status: "OPEN",
  women_only: false,
  owner_first_name: "Demo",
  stops: [
    { seq: 1, label: "Demo Stop 09", eta_offset_min: 35 },
    { seq: 0, label: "Demo Palwal Start", eta_offset_min: 0 },
    { seq: 2, label: "Demo Cyber City", eta_offset_min: 70 },
  ],
};

describe("routeSummary", () => {
  it("goes from the first stop to the last, whatever order they arrive in", () => {
    expect(routeSummary(ride.stops)).toBe(
      "Demo Palwal Start → Demo Cyber City",
    );
  });

  it("has a fallback when there are no stops", () => {
    expect(routeSummary([])).toBe("A shared ride");
  });
});

describe("seatsSummary", () => {
  it.each([
    [{ seats_left: 2, status: "OPEN" }, "2 seats"],
    [{ seats_left: 1, status: "OPEN" }, "1 seat"],
    [{ seats_left: 0, status: "FULL" }, "Full"],
    [{ seats_left: 2, status: "CANCELLED" }, "Cancelled"],
    [{ seats_left: 2, status: "STARTED" }, "Already left"],
  ])("%j → %s", (input, expected) => {
    expect(seatsSummary(input)).toBe(expected);
  });
});

describe("cardLine and shareMessage", () => {
  it("reads like the WhatsApp posts people write today", () => {
    expect(cardLine(ride)).toBe(
      "Demo Palwal Start → Demo Cyber City · Sat, 17 Oct · 08:00 · 2 seats · ₹150",
    );
  });

  it("puts the link on its own line", () => {
    expect(shareMessage(ride, "https://example.com/r/abc")).toBe(
      `${cardLine(ride)}\nhttps://example.com/r/abc`,
    );
  });
});
