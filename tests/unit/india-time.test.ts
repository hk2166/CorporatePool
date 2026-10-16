import { describe, expect, it } from "vitest";
import { addDays, dayLabel, indiaDate, indiaTime } from "@/lib/india-time";

describe("indiaDate", () => {
  it("is already tomorrow in India late in the UTC evening", () => {
    // 20:00 UTC on 16 Oct is 01:30 on 17 Oct in India.
    expect(indiaDate(new Date("2026-10-16T20:00:00Z"))).toBe("2026-10-17");
  });

  it("is still today in India just before midnight IST", () => {
    // 18:29 UTC is 23:59 in India.
    expect(indiaDate(new Date("2026-10-16T18:29:00Z"))).toBe("2026-10-16");
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayLabel", () => {
  it("reads like a short date", () => {
    expect(dayLabel("2026-10-17")).toBe("Sat, 17 Oct");
  });
});

describe("indiaTime", () => {
  it("shows the time in India", () => {
    expect(indiaTime("2026-10-17T02:30:00Z")).toBe("08:00");
  });
});
