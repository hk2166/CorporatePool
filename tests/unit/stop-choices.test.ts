import { describe, expect, it } from "vitest";
import { pickedByOthers, placesLeft } from "@/lib/stop-choices";

const places = [
  { id: "hudda" },
  { id: "agra" },
  { id: "bus" },
  { id: "rajiv" },
];
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("pickedByOthers", () => {
  it("is what the other pickers chose, ignoring empty ones", () => {
    expect(pickedByOthers(["hudda", "agra", "", "bus"], 1)).toEqual([
      "hudda",
      "bus",
    ]);
  });

  it("never takes a picker's own stop, even when another picked it too", () => {
    expect(pickedByOthers(["hudda", "hudda", "agra"], 0)).toEqual(["agra"]);
  });
});

describe("placesLeft", () => {
  it("leaves out stops picked elsewhere, keeping this picker's own", () => {
    const picks = ["hudda", "agra", "bus", ""];
    // The 2nd picker (Agra Chowk) still offers Agra Chowk, and Rajiv Chowk, not the others.
    expect(ids(placesLeft(places, pickedByOthers(picks, 1)))).toEqual([
      "agra",
      "rajiv",
    ]);
    // The empty 4th picker offers only what nobody has picked.
    expect(ids(placesLeft(places, pickedByOthers(picks, 3)))).toEqual([
      "rajiv",
    ]);
  });

  it("offers everything when nothing else is picked", () => {
    expect(ids(placesLeft(places, []))).toEqual(ids(places));
  });
});
