import { describe, expect, it } from "vitest";
import { cityOf, distanceKm, groupByCity, OTHER_CITY } from "@/lib/cities";

// The live stops (migrations 20261016174411_common_stops and 20261016175937_agra_chowk).
const STOPS = {
  "Agra Chowk": { lat: 28.144, lng: 77.329 },
  Hodal: { lat: 27.89992, lng: 77.37393 },
  "Subhash Chowk": { lat: 28.42772, lng: 77.03711 },
  "Rajiv Chowk": { lat: 28.4455, lng: 77.03335 },
  "Shankar Chowk (Shyam Chowk)": { lat: 28.49571, lng: 77.08607 },
  "DLF Cyber Park": { lat: 28.50302, lng: 77.08979 },
  "Sector 55-56 Rapid Metro": { lat: 28.42336, lng: 77.10513 },
  "Paras Trinity, Sector 63": { lat: 28.401, lng: 77.09166 },
  Badshahpur: { lat: 28.39328, lng: 77.04842 },
};

describe("distanceKm", () => {
  it("measures along the ground", () => {
    // A degree of latitude is about 111.2 km anywhere.
    expect(distanceKm({ lat: 28, lng: 77 }, { lat: 29, lng: 77 })).toBeCloseTo(
      111.2,
      0,
    );
    // Agra Chowk to Shankar Chowk: about 46 km in a straight line.
    expect(
      distanceKm(STOPS["Agra Chowk"], STOPS["Shankar Chowk (Shyam Chowk)"]),
    ).toBeCloseTo(45.8, 0);
  });
});

describe("cityOf", () => {
  it("puts the Palwal and Hodal stops in their towns", () => {
    expect(cityOf(STOPS["Agra Chowk"])).toBe("Palwal");
    expect(cityOf(STOPS.Hodal)).toBe("Hodal");
  });

  it("puts every Gurugram stop in Gurugram, even the southern ones nearer Sohna", () => {
    for (const name of [
      "Subhash Chowk",
      "Rajiv Chowk",
      "Shankar Chowk (Shyam Chowk)",
      "DLF Cyber Park",
      "Sector 55-56 Rapid Metro",
      "Paras Trinity, Sector 63",
      "Badshahpur",
    ] as const) {
      expect(cityOf(STOPS[name]), name).toBe("Gurugram");
    }
  });

  it("says Other places for somewhere far from every town", () => {
    expect(cityOf({ lat: 27.2, lng: 78.0 })).toBe(OTHER_CITY);
  });
});

describe("groupByCity", () => {
  it("groups south to north, keeping the stops' order, other places last", () => {
    const list = [
      { name: "Hodal", ...STOPS.Hodal },
      { name: "Agra Chowk", ...STOPS["Agra Chowk"] },
      { name: "Far away", lat: 27.2, lng: 78.0 },
      { name: "Subhash Chowk", ...STOPS["Subhash Chowk"] },
      { name: "Rajiv Chowk", ...STOPS["Rajiv Chowk"] },
    ];
    expect(
      groupByCity(list).map((g) => [g.city, g.places.map((p) => p.name)]),
    ).toEqual([
      ["Hodal", ["Hodal"]],
      ["Palwal", ["Agra Chowk"]],
      ["Gurugram", ["Subhash Chowk", "Rajiv Chowk"]],
      [OTHER_CITY, ["Far away"]],
    ]);
  });
});
