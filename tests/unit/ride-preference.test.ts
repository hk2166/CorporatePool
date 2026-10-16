import { describe, expect, it } from "vitest";
import {
  homeSections,
  isCarOwner,
  parseRidePreference,
} from "@/lib/ride-preference";

describe("parseRidePreference", () => {
  it("accepts the three answers and nothing else", () => {
    expect(parseRidePreference("RIDER")).toBe("RIDER");
    expect(parseRidePreference("DRIVER")).toBe("DRIVER");
    expect(parseRidePreference("BOTH")).toBe("BOTH");
    expect(parseRidePreference("rider")).toBeNull();
    expect(parseRidePreference(null)).toBeNull();
  });
});

describe("homeSections", () => {
  it("shows riders only riding", () => {
    expect(homeSections("RIDER")).toEqual(["riding"]);
  });

  it("puts driving first for drivers, who may still ride", () => {
    expect(homeSections("DRIVER")).toEqual(["driving", "riding"]);
  });

  it("shows both, riding first, for both and for members who haven't answered", () => {
    expect(homeSections("BOTH")).toEqual(["riding", "driving"]);
    expect(homeSections(null)).toEqual(["riding", "driving"]);
  });
});

describe("isCarOwner", () => {
  it("is true for drivers and both, false for riders and the undecided", () => {
    expect(isCarOwner("DRIVER")).toBe(true);
    expect(isCarOwner("BOTH")).toBe(true);
    expect(isCarOwner("RIDER")).toBe(false);
    expect(isCarOwner(null)).toBe(false);
  });
});
