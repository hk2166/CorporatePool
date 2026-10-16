import { describe, expect, it } from "vitest";
import { arrangeFeedback, feedbackSort } from "@/lib/feedback";

const item = (id: string, status: string, votes: number, day: string) => ({
  id,
  status,
  votes,
  created_at: `2026-10-${day}T09:00:00Z`,
});

const items = [
  item("a", "OPEN", 2, "10"),
  item("b", "PLANNED", 5, "11"),
  item("c", "OPEN", 2, "12"),
  item("d", "DONE", 9, "13"),
  item("e", "DECLINED", 1, "14"),
];
const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe("feedbackSort", () => {
  it("is most wanted unless asked for newest", () => {
    expect(feedbackSort("new")).toBe("new");
    expect(feedbackSort(undefined)).toBe("top");
    expect(feedbackSort("nonsense")).toBe("top");
  });
});

describe("arrangeFeedback", () => {
  it("puts the most votes first, newest first on a tie", () => {
    expect(ids(arrangeFeedback(items, "top").open)).toEqual(["b", "c", "a"]);
  });

  it("can list the newest first", () => {
    expect(ids(arrangeFeedback(items, "new").open)).toEqual(["c", "b", "a"]);
  });

  it("keeps finished items apart, newest first", () => {
    expect(ids(arrangeFeedback(items, "top").closed)).toEqual(["e", "d"]);
  });
});
