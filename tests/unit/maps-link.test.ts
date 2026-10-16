import { describe, expect, it } from "vitest";
import { cleanLink, isShortMapsLink, pointFromText } from "@/lib/maps-link";

describe("pointFromText", () => {
  it("reads coordinates as Google Maps copies them", () => {
    expect(pointFromText("28.1440, 77.3290")).toEqual({
      lat: 28.144,
      lng: 77.329,
    });
  });

  it("reads a dropped pin's link (where maps.app.goo.gl links lead)", () => {
    expect(
      pointFromText(
        "https://www.google.com/maps/search/28.146986,+77.313914?entry=tts&g_ep=EgoyMDI2",
      ),
    ).toEqual({ lat: 28.146986, lng: 77.313914 });
  });

  it("prefers a place's own position over the middle of the map", () => {
    expect(
      pointFromText(
        "https://www.google.com/maps/place/Rajiv+Chowk/@28.4400,77.0300,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d28.4455!4d77.03335!16s",
      ),
    ).toEqual({ lat: 28.4455, lng: 77.03335 });
  });

  it("reads ?q= and the newer ?query= links", () => {
    expect(pointFromText("https://maps.google.com/?q=28.1440,77.3290")).toEqual(
      {
        lat: 28.144,
        lng: 77.329,
      },
    );
    expect(
      pointFromText(
        "https://www.google.com/maps/search/?api=1&query=28.1440%2C77.3290",
      ),
    ).toEqual({ lat: 28.144, lng: 77.329 });
  });

  it("falls back to the middle of the map view", () => {
    expect(
      pointFromText("https://www.google.co.in/maps/@28.4955,77.0861,16z"),
    ).toEqual({ lat: 28.4955, lng: 77.0861 });
  });

  it("reads geo: links", () => {
    expect(pointFromText("geo:28.144,77.329")).toEqual({
      lat: 28.144,
      lng: 77.329,
    });
  });

  it("finds nothing in a short link (the server follows those) or other sites", () => {
    expect(
      pointFromText("https://maps.app.goo.gl/gckhaEaM8exobJ9F7"),
    ).toBeNull();
    expect(pointFromText("https://example.com/maps/@28.1,77.3,10z")).toBeNull();
    expect(pointFromText("Agra Chowk")).toBeNull();
    expect(pointFromText("https://maps.google.com/?q=95,200")).toBeNull();
  });
});

describe("isShortMapsLink", () => {
  it("knows Google's short links and nothing else", () => {
    expect(isShortMapsLink("https://maps.app.goo.gl/gckhaEaM8exobJ9F7")).toBe(
      true,
    );
    expect(isShortMapsLink("https://goo.gl/maps/abc123")).toBe(true);
    expect(isShortMapsLink("http://maps.app.goo.gl/abc")).toBe(false);
    expect(isShortMapsLink("https://goo.gl/abc123")).toBe(false);
    expect(isShortMapsLink("https://evil.example/maps.app.goo.gl")).toBe(false);
  });
});

describe("cleanLink", () => {
  it("keeps web links up to 500 characters", () => {
    expect(cleanLink(" https://maps.app.goo.gl/x ")).toBe(
      "https://maps.app.goo.gl/x",
    );
    expect(cleanLink("javascript:alert(1)")).toBeNull();
    expect(cleanLink(`https://e.com/${"a".repeat(500)}`)).toBeNull();
  });
});
