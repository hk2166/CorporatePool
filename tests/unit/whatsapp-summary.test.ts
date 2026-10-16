import { describe, expect, it } from "vitest";
import { whatsappShareUrl, whatsappSummary } from "@/lib/whatsapp-summary";

const SITE = "https://corporatepool.vercel.app";

describe("whatsappSummary", () => {
  it("lists tomorrow's cars, morning then evening, each with its link", () => {
    const text = whatsappSummary({
      day: "2026-10-18",
      label: "Tomorrow",
      site: SITE,
      rides: [
        {
          id: "e1",
          departAt: "2026-10-18T12:30:00Z", // 18:00 in India
          stops: ["Shankar Chowk", "Agra Chowk"],
          seatsLeft: 1,
          price: 110,
          driver: "Bhupinder Gautam",
        },
        {
          id: "m1",
          departAt: "2026-10-18T02:45:00Z", // 08:15
          stops: [
            "Agra Chowk",
            "Subhash Chowk",
            "Rajiv Chowk",
            "IFFCO Chowk",
            "Shankar Chowk",
          ],
          seatsLeft: 3,
          price: 120,
          driver: "Sachin",
        },
      ],
    });
    expect(text).toBe(
      [
        "🚗 Rides tomorrow, Sun, 18 Oct, on CorporatePool",
        "",
        "*Morning*",
        "• 08:15 Agra Chowk → Shankar Chowk (via Subhash Chowk, Rajiv Chowk…) · 3 seats · ₹120 · Sachin",
        `  ${SITE}/r/m1`,
        "",
        "*Evening*",
        "• 18:00 Shankar Chowk → Agra Chowk · 1 seat · ₹110 · Bhupinder",
        `  ${SITE}/r/e1`,
        "",
        `Ask for a seat in the app: ${SITE}`,
      ].join("\n"),
    );
  });

  it("still says something useful with no cars", () => {
    expect(
      whatsappSummary({
        day: "2026-10-18",
        label: "Today",
        site: SITE,
        rides: [],
      }),
    ).toBe(
      `🚗 Rides today, Sun, 18 Oct, on CorporatePool\n\nNo cars yet. Driving? Offer your seats in the app.\n\nAsk for a seat in the app: ${SITE}`,
    );
  });
});

describe("whatsappShareUrl", () => {
  it("opens WhatsApp with the message ready", () => {
    expect(whatsappShareUrl("Hi → there & you")).toBe(
      "https://wa.me/?text=Hi%20%E2%86%92%20there%20%26%20you",
    );
  });
});
