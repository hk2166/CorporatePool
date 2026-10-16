import { describe, expect, it } from "vitest";
import {
  cleanName,
  isUpiId,
  normalizeIndianMobile,
} from "@/lib/profile-fields";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["(+91) 98765-43210", "+919876543210"],
  ])("reads %s as %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["12345 67890", "doesn't start with 6–9"],
    ["98765 4321", "too short"],
    ["98765 432100", "too long"],
    ["+1 415 555 0100", "not an Indian number"],
    ["98765abcde", "letters"],
    ["", "empty"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("isUpiId", () => {
  it("accepts ordinary UPI IDs", () => {
    expect(isUpiId("demo.owner@okaxis")).toBe(true);
    expect(isUpiId("9876543210@ybl")).toBe(true);
  });

  it("rejects things that aren't", () => {
    expect(isUpiId("demo.owner")).toBe(false);
    expect(isUpiId("demo owner@okaxis")).toBe(false);
    expect(isUpiId("@okaxis")).toBe(false);
  });
});

describe("cleanName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanName("  Demo   Person ")).toBe("Demo Person");
  });

  it("rejects empty and over-long names", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(81))).toBeNull();
  });
});
