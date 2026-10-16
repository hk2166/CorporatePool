import { describe, expect, it } from "vitest";
import {
  checkStops,
  describeWeekdays,
  parseDepartTime,
  weekdayBit,
  weekdaysToMask,
  parseDirection,
  reverseStops,
  withRoles,
} from "@/lib/usual-ride";

describe("weekdaysToMask", () => {
  it("adds up the chosen days", () => {
    expect(weekdaysToMask([1, 2, 4, 8, 16])).toBe(31); // Mon–Fri
    expect(weekdaysToMask([])).toBe(0);
  });

  it("ignores anything that isn't a weekday bit", () => {
    expect(weekdaysToMask([1, 3, 128])).toBe(1);
  });
});

describe("checkStops", () => {
  // Pickup first, the rest drops, unless the test says otherwise.
  const stop = (
    placeId: string,
    etaOffsetMin: number,
    role: "pickup" | "drop" = etaOffsetMin === 0 ? "pickup" : "drop",
  ) => ({ placeId, etaOffsetMin, role });

  it("accepts pickups then drops in time order", () => {
    expect(checkStops([stop("a", 0), stop("b", 30), stop("c", 70)])).toBeNull();
    expect(
      checkStops([stop("a", 0), stop("b", 15, "pickup"), stop("c", 70)]),
    ).toBeNull();
  });

  it.each([
    [[stop("a", 0)], "at least one pickup spot and one drop spot"],
    [[stop("a", 0, "drop"), stop("b", 30)], "at least one pickup spot"],
    [
      [stop("a", 0), stop("b", 30), stop("c", 40, "pickup")],
      "Pickup spots come before drop spots",
    ],
    [[stop("a", 0), stop("", 30)], "Pick a place"],
    [[stop("a", 0), stop("a", 30)], "only once"],
    [[stop("a", 5, "pickup"), stop("b", 30)], "where you set off"],
    [[stop("a", 0), stop("b", 30), stop("c", 30)], "later than the one before"],
    [[stop("a", 0), stop("b", 601)], "at most 600"],
    [[stop("a", 0), stop("b", 12.5)], "whole minutes"],
  ])("rejects %j", (stops, message) => {
    expect(checkStops(stops)).toContain(message);
  });
});

describe("parseDepartTime", () => {
  it("accepts 24-hour times", () => {
    expect(parseDepartTime("08:00")).toBe("08:00");
    expect(parseDepartTime(" 18:30 ")).toBe("18:30");
  });

  it.each(["8:00", "24:00", "08:60", "08:00:00", "eight"])(
    "rejects %s",
    (value) => {
      expect(parseDepartTime(value)).toBeNull();
    },
  );
});

describe("weekdayBit", () => {
  it("numbers days Monday first", () => {
    expect(weekdayBit("2026-10-19")).toBe(1); // Monday
    expect(weekdayBit("2026-10-23")).toBe(16); // Friday
    expect(weekdayBit("2026-10-25")).toBe(64); // Sunday
  });
});

describe("describeWeekdays", () => {
  it("names common patterns", () => {
    expect(describeWeekdays(127)).toBe("every day");
    expect(describeWeekdays(31)).toBe("Mon–Fri");
    expect(describeWeekdays(96)).toBe("weekends");
  });

  it("lists anything else", () => {
    expect(describeWeekdays(1 | 4 | 16)).toBe("Mon, Wed, Fri");
  });
});

describe("parseDirection", () => {
  it("is evening only when it says so", () => {
    expect(parseDirection("EVENING")).toBe("EVENING");
    expect(parseDirection("MORNING")).toBe("MORNING");
    expect(parseDirection(null)).toBe("MORNING");
  });
});

describe("reverseStops", () => {
  it("runs the morning route backwards, timed from the evening start", () => {
    expect(
      reverseStops([
        { placeId: "palwal", etaOffsetMin: 0, role: "pickup" },
        { placeId: "rajiv", etaOffsetMin: 45, role: "drop" },
        { placeId: "cyber", etaOffsetMin: 60, role: "drop" },
      ]),
    ).toEqual([
      { placeId: "cyber", etaOffsetMin: 0, role: "pickup" },
      { placeId: "rajiv", etaOffsetMin: 15, role: "pickup" },
      { placeId: "palwal", etaOffsetMin: 60, role: "drop" },
    ]);
  });
});

describe("withRoles", () => {
  it("keeps saved roles and gives old rides a pickup start and drops after", () => {
    expect(
      withRoles([
        { placeId: "a", etaOffsetMin: 0 },
        { placeId: "b", etaOffsetMin: 30 },
        { placeId: "c", etaOffsetMin: 60, role: "pickup" },
      ]).map((s) => s.role),
    ).toEqual(["pickup", "drop", "pickup"]);
  });
});
