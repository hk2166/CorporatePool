import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeatsLeft } from "@/components/seats-left";

describe("SeatsLeft", () => {
  it("says Full when no seats are left", () => {
    render(<SeatsLeft seatsLeft={0} />);
    expect(screen.getByText("Full")).toBeDefined();
  });

  it("uses the singular for one seat", () => {
    render(<SeatsLeft seatsLeft={1} />);
    expect(screen.getByText("1 seat left")).toBeDefined();
  });

  it("uses the plural for several seats", () => {
    render(<SeatsLeft seatsLeft={3} />);
    expect(screen.getByText("3 seats left")).toBeDefined();
  });
});
