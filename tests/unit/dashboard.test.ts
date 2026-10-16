import { describe, expect, it } from "vitest";
import {
  areaPath,
  axis,
  fillPercent,
  labelledDays,
  linePath,
  rangeDays,
  scoreBands,
} from "@/lib/dashboard";

describe("rangeDays", () => {
  it("accepts the offered ranges and falls back to 30 days", () => {
    expect(rangeDays("7")).toBe(7);
    expect(rangeDays("90")).toBe(90);
    expect(rangeDays("8")).toBe(30);
    expect(rangeDays(undefined)).toBe(30);
  });
});

describe("axis", () => {
  it("has whole, even steps just above the largest value", () => {
    expect(axis(0)).toEqual({ max: 3, ticks: [0, 1, 2, 3] });
    expect(axis(3)).toEqual({ max: 3, ticks: [0, 1, 2, 3] });
    expect(axis(7)).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
    expect(axis(23)).toEqual({ max: 25, ticks: [0, 5, 10, 15, 20, 25] });
    expect(axis(140).max).toBe(150);
  });
});

describe("linePath and areaPath", () => {
  it("puts each day in the middle of its slot, scaled to the top", () => {
    expect(linePath([0, 5, 10], 10)).toBe("M166.7,100 L500,50 L833.3,0");
  });

  it("closes the area down to the axis", () => {
    expect(areaPath([10, 10], 10)).toBe("M250,0 L750,0 L750,100 L250,100 Z");
    expect(areaPath([], 10)).toBe("");
  });
});

describe("labelledDays", () => {
  it("labels every day when there are few", () => {
    expect(labelledDays(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("spreads about seven labels and always labels today", () => {
    const picked = labelledDays(30);
    expect(picked.at(-1)).toBe(29);
    expect(picked.length).toBeLessThanOrEqual(7);
  });
});

describe("scoreBands", () => {
  it("counts scores in bands of 20, with 100 in the top band", () => {
    expect(scoreBands([0, 19, 20, 50, 79, 80, 100])).toEqual([2, 1, 1, 1, 2]);
  });
});

describe("fillPercent", () => {
  it("rounds, and is null when no seats were offered", () => {
    expect(fillPercent(2, 3)).toBe(67);
    expect(fillPercent(0, 0)).toBeNull();
  });
});
