import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next-path";

describe("safeNextPath", () => {
  it("keeps paths on this site, with their query string", () => {
    expect(safeNextPath("/rides/abc?seat=1")).toBe("/rides/abc?seat=1");
  });

  it("falls back to the home page when there's nothing", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("refuses other sites, however they're written", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });
});
