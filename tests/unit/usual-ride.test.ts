import { describe, expect, it } from "vitest";
import { checkStops, parseDepartTime, weekdaysToMask } from "@/lib/usual-ride";

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
  const stop = (placeId: string, etaOffsetMin: number) => ({
    placeId,
    etaOffsetMin,
  });

  it("accepts a start, a middle and an end in time order", () => {
    expect(checkStops([stop("a", 0), stop("b", 30), stop("c", 70)])).toBeNull();
  });

  it.each([
    [[stop("a", 0)], "at least a start and an end"],
    [[stop("a", 0), stop("", 30)], "Pick a place"],
    [[stop("a", 0), stop("a", 30)], "only once"],
    [[stop("a", 5), stop("b", 30)], "where you set off"],
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
