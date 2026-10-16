import { describe, expect, it } from "vitest";
import {
  lastSeen,
  memberSort,
  percent,
  sortMembers,
  splitByDeparture,
  type MemberRow,
} from "@/lib/admin";

const member = (name: string, over: Partial<MemberRow> = {}): MemberRow => ({
  name,
  reliability_score: 50,
  rides_offered: 0,
  rides_taken: 0,
  active_days_30: 0,
  last_active: null,
  joined_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("memberSort", () => {
  it("accepts the known orders and falls back to newest", () => {
    expect(memberSort("taken")).toBe("taken");
    expect(memberSort("nonsense")).toBe("joined");
    expect(memberSort(undefined)).toBe("joined");
    expect(memberSort(["taken"])).toBe("joined");
  });
});

describe("sortMembers", () => {
  const rows = [
    member("Asha", {
      rides_taken: 3,
      active_days_30: 2,
      last_active: "2026-10-10",
    }),
    member("Bilal", {
      rides_offered: 5,
      active_days_30: 9,
      joined_at: "2026-10-12T00:00:00Z",
    }),
    member("Chitra", {
      rides_taken: 3,
      reliability_score: 80,
      active_days_30: 2,
      last_active: "2026-10-15",
    }),
  ];
  const names = (sort: Parameters<typeof sortMembers>[1]) =>
    sortMembers(rows, sort).map((r) => r.name);

  it("puts the newest first", () => {
    expect(names("joined")).toEqual(["Bilal", "Asha", "Chitra"]);
  });

  it("ranks by active days, then by who was in most recently", () => {
    expect(names("active")).toEqual(["Bilal", "Chitra", "Asha"]);
  });

  it("ranks drivers and riders, ties by name", () => {
    expect(names("driven")).toEqual(["Bilal", "Asha", "Chitra"]);
    expect(names("taken")).toEqual(["Asha", "Chitra", "Bilal"]);
  });

  it("ranks by reliability", () => {
    expect(names("score")[0]).toBe("Chitra");
  });

  it("leaves the original list alone", () => {
    sortMembers(rows, "name");
    expect(rows.map((r) => r.name)).toEqual(["Asha", "Bilal", "Chitra"]);
  });
});

describe("lastSeen", () => {
  it("says when, in days", () => {
    expect(lastSeen("2026-10-16", "2026-10-16")).toBe("Today");
    expect(lastSeen("2026-10-15", "2026-10-16")).toBe("Yesterday");
    expect(lastSeen("2026-09-30", "2026-10-16")).toBe("16 days ago");
    expect(lastSeen(null, "2026-10-16")).toBe("Never");
  });
});

describe("percent", () => {
  it("rounds, and copes with nothing to divide by", () => {
    expect(percent(2, 3)).toBe("67%");
    expect(percent(0, 0)).toBe("–");
  });
});

describe("splitByDeparture", () => {
  it("puts the next ride first and the latest past ride first", () => {
    const rides = [
      { id: "c", depart_at: "2026-10-18T02:30:00Z" },
      { id: "b", depart_at: "2026-10-17T02:30:00Z" },
      { id: "a", depart_at: "2026-10-15T02:30:00Z" },
      { id: "z", depart_at: "2026-10-14T02:30:00Z" },
    ];
    const { upcoming, past } = splitByDeparture(
      rides,
      new Date("2026-10-16T12:00:00Z"),
    );
    expect(upcoming.map((r) => r.id)).toEqual(["b", "c"]);
    expect(past.map((r) => r.id)).toEqual(["a", "z"]);
  });
});
