import { describe, expect, it } from "vitest";
import { routeKm, straightLineKm, suggestedPricePerSeat } from "@/lib/pricing";

// Roughly Palwal and Shankar Chowk.
const palwal = { lat: 28.144, lng: 77.329 };
const shankarChowk = { lat: 28.4955, lng: 77.0886 };

describe("straightLineKm", () => {
  it("measures Palwal to Shankar Chowk at about 45 km", () => {
    expect(straightLineKm(palwal, shankarChowk)).toBeGreaterThan(44);
    expect(straightLineKm(palwal, shankarChowk)).toBeLessThan(47);
  });

  it("is zero for the same point", () => {
    expect(straightLineKm(palwal, palwal)).toBe(0);
  });
});

describe("routeKm", () => {
  it("adds up the legs and allows for roads not being straight", () => {
    const middle = { lat: 28.32, lng: 77.2 };
    const direct =
      straightLineKm(palwal, middle) + straightLineKm(middle, shankarChowk);
    expect(routeKm([palwal, middle, shankarChowk])).toBeCloseTo(
      direct * 1.3,
      5,
    );
  });
});

describe("suggestedPricePerSeat", () => {
  it("splits the trip's running cost between the driver and the seats", () => {
    // ~59 km by road × ₹7 = ~₹410, split 4 ways (3 seats + driver) ≈ ₹100.
    expect(suggestedPricePerSeat([palwal, shankarChowk], 3)).toBe(100);
  });

  it("costs more per seat when fewer seats share it", () => {
    expect(suggestedPricePerSeat([palwal, shankarChowk], 1)).toBeGreaterThan(
      suggestedPricePerSeat([palwal, shankarChowk], 3),
    );
  });

  it("rounds to ₹10 and never suggests less than ₹10", () => {
    const nearby = { lat: 28.145, lng: 77.329 };
    expect(suggestedPricePerSeat([palwal, nearby], 3)).toBe(10);
  });

  it("gives 0 when there's no route yet", () => {
    expect(suggestedPricePerSeat([palwal], 3)).toBe(0);
  });
});
