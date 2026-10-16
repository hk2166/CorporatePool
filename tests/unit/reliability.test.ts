import { describe, expect, it } from "vitest";
import { eventCounts, reliabilityScore } from "@/lib/reliability";

// The same cases as supabase/tests/86_reliability_score.test.sql, so the page and the database
// can't disagree.
describe("reliabilityScore", () => {
  const score = (ridesCompleted: number, noShows = 0, lateCancels = 0) =>
    reliabilityScore({ ridesCompleted, noShows, lateCancels });

  it("starts a new rider at 50", () => expect(score(0)).toBe(50));
  it("adds 2 for each completed ride", () => expect(score(5)).toBe(60));
  it("adds at most 40 for rides", () => {
    expect(score(20)).toBe(90);
    expect(score(300)).toBe(90);
  });
  it("takes 15 for a no-show", () => expect(score(10, 1)).toBe(55));
  it("takes 5 for a late cancel", () => expect(score(10, 0, 1)).toBe(65));
  it("never goes below 0", () => expect(score(0, 5)).toBe(0));
});

describe("eventCounts", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("counts a miss for 90 days", () => {
    expect(eventCounts("NO_SHOW", daysAgo(89), now)).toBe(true);
    expect(eventCounts("LATE_CANCEL", daysAgo(91), now)).toBe(false);
  });
  it("always counts a completed ride", () => {
    expect(eventCounts("COMPLETED", daysAgo(400), now)).toBe(true);
  });
});
