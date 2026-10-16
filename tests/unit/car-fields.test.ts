import { describe, expect, it } from "vitest";
import { cleanCarText, isIndianPlate, normalizePlate } from "@/lib/car-fields";

describe("normalizePlate", () => {
  it.each([
    ["HR 26 AB 1234", "HR26AB1234"],
    ["hr-26-ab-1234", "HR26AB1234"],
    ["HR.26.AB.1234", "HR26AB1234"],
    [" dl 3c ab 1234 ", "DL3CAB1234"],
  ])("writes %s as %s", (input, expected) => {
    expect(normalizePlate(input)).toBe(expected);
  });
});

describe("isIndianPlate", () => {
  it.each(["HR26AB1234", "DL3CAB1234", "HR261234", "UP16Z5", "22BH1234AA"])(
    "accepts %s",
    (plate) => expect(isIndianPlate(plate)).toBe(true),
  );

  it.each(["HELLO", "1234", "HR26AB12345", "22BH12AA", "H26AB1234"])(
    "rejects %s",
    (plate) => expect(isIndianPlate(plate)).toBe(false),
  );
});

describe("cleanCarText", () => {
  it("trims and collapses spaces", () => {
    expect(cleanCarText("  Maruti   Swift ", 2, 60)).toBe("Maruti Swift");
  });

  it("enforces the length limits", () => {
    expect(cleanCarText("X", 2, 60)).toBeNull();
    expect(cleanCarText("x".repeat(61), 2, 60)).toBeNull();
  });
});
