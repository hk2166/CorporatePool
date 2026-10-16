import { describe, expect, it } from "vitest";
import { formatCoordinates, parseCoordinates } from "@/lib/coordinates";

describe("parseCoordinates", () => {
  it("reads what Google Maps copies", () => {
    expect(parseCoordinates("28.1440, 77.3290")).toEqual({
      lat: 28.144,
      lng: 77.329,
    });
  });
  it("is forgiving about spaces", () => {
    expect(parseCoordinates("  28.1440 77.3290 ")).toEqual({
      lat: 28.144,
      lng: 77.329,
    });
    expect(parseCoordinates("28.1440,77.3290")).toEqual({
      lat: 28.144,
      lng: 77.329,
    });
  });
  it("refuses anything else", () => {
    expect(parseCoordinates("Palwal")).toBeNull();
    expect(parseCoordinates("128.1, 77.3")).toBeNull();
    expect(parseCoordinates("28.1, 277.3")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });
});

describe("formatCoordinates", () => {
  it("writes five decimals", () => {
    expect(formatCoordinates(28.144, 77.329)).toBe("28.14400, 77.32900");
  });
});
