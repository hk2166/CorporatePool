import { describe, expect, it } from "vitest";
import {
  dayChoices,
  parseSearchQuery,
  searchHref,
  timeWindow,
  walkLabel,
} from "@/lib/search-query";

const today = "2026-10-16";
const home = "10000000-0000-0000-0000-0000000000a1";
const work = "10000000-0000-0000-0000-0000000000b2";

describe("parseSearchQuery", () => {
  it("reads a full search", () => {
    expect(
      parseSearchQuery(
        {
          from: home,
          to: work,
          date: "2026-10-17",
          after: "07:00",
          before: "09:00",
          seats: "2",
        },
        today,
      ),
    ).toEqual({
      from: home,
      to: work,
      date: "2026-10-17",
      after: "07:00",
      before: "09:00",
      seats: 2,
    });
  });

  it("defaults to tomorrow, any time, one seat", () => {
    expect(parseSearchQuery({}, today)).toEqual({
      from: null,
      to: null,
      date: "2026-10-17",
      after: null,
      before: null,
      seats: 1,
    });
  });

  it("ignores days in the past or too far ahead", () => {
    expect(parseSearchQuery({ date: "2026-10-15" }, today).date).toBe(
      "2026-10-17",
    );
    expect(parseSearchQuery({ date: "2026-10-22" }, today).date).toBe(
      "2026-10-22",
    );
    expect(parseSearchQuery({ date: "2026-10-23" }, today).date).toBe(
      "2026-10-17",
    );
  });

  it("ignores anything that isn't a place id, a whole hour or 1–4 seats", () => {
    const q = parseSearchQuery(
      { from: "palwal", after: "7am", before: "09:30", seats: "9" },
      today,
    );
    expect([q.from, q.after, q.before, q.seats]).toEqual([null, null, null, 1]);
  });

  it("turns a backwards window around", () => {
    const q = parseSearchQuery({ after: "09:00", before: "07:00" }, today);
    expect([q.after, q.before]).toEqual(["07:00", "09:00"]);
  });

  it("takes the first of repeated parameters", () => {
    expect(parseSearchQuery({ seats: ["3", "1"] }, today).seats).toBe(3);
  });
});

describe("timeWindow", () => {
  const base = parseSearchQuery({}, today);

  it("is the whole day by default", () => {
    expect(timeWindow(base)).toEqual({ from: "00:00", to: "23:59:59" });
  });

  it("includes the end time", () => {
    expect(timeWindow({ ...base, after: "08:00", before: "09:00" })).toEqual({
      from: "08:00",
      to: "09:00",
    });
  });

  it("treats a single hour as that whole hour", () => {
    expect(timeWindow({ ...base, after: "08:00", before: "08:00" })).toEqual({
      from: "08:00",
      to: "08:59:59",
    });
  });
});

describe("searchHref", () => {
  it("round-trips through parseSearchQuery", () => {
    const q = parseSearchQuery(
      { from: home, to: work, date: "2026-10-18", after: "07:00", seats: "2" },
      today,
    );
    const params = Object.fromEntries(
      new URLSearchParams(searchHref(q).split("?")[1]),
    );
    expect(parseSearchQuery(params, today)).toEqual(q);
  });

  it("leaves out defaults", () => {
    expect(searchHref(parseSearchQuery({ from: home }, today))).toBe(
      `/search?from=${home}&date=2026-10-17`,
    );
  });
});

describe("dayChoices", () => {
  it("offers today, tomorrow and the five days after", () => {
    const days = dayChoices(today);
    expect(days).toHaveLength(7);
    expect(days.slice(0, 3)).toEqual([
      { value: "2026-10-16", label: "Today" },
      { value: "2026-10-17", label: "Tomorrow" },
      { value: "2026-10-18", label: "Sun, 18 Oct" },
    ]);
  });
});

describe("walkLabel", () => {
  it("says how far the stop is", () => {
    expect(walkLabel(40)).toBe("at the stop");
    expect(walkLabel(330)).toBe("350 m walk");
    expect(walkLabel(980)).toBe("1.0 km walk");
    expect(walkLabel(1240)).toBe("1.2 km walk");
  });
});
