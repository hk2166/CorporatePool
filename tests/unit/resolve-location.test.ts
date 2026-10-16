import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { resolveLocation } = await import("@/lib/resolve-location");

// Google's answer to a request: a redirect to `location`, or a page without one.
function redirectTo(location: string | null) {
  return new Response(null, {
    status: location ? 302 : 200,
    headers: location ? { location } : {},
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveLocation", () => {
  it("reads coordinates and full links without going online", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await resolveLocation("28.1440, 77.3290")).toEqual({
      point: { lat: 28.144, lng: 77.329 },
      link: null,
    });
    expect(
      (await resolveLocation("https://maps.google.com/?q=28.144,77.329")).point,
    ).toEqual({ lat: 28.144, lng: 77.329 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("follows a short link to the position it points at", async () => {
    const fetch = vi.fn(async () =>
      redirectTo(
        "https://www.google.com/maps/search/28.146986,+77.313914?entry=tts",
      ),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await resolveLocation("https://maps.app.goo.gl/gckhaEaM8exobJ9F7"),
    ).toEqual({
      point: { lat: 28.146986, lng: 77.313914 },
      link: "https://maps.app.goo.gl/gckhaEaM8exobJ9F7",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("never follows a redirect away from Google", async () => {
    const fetch = vi.fn(async () =>
      redirectTo("https://evil.example/maps/search/28.1,77.3"),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      (await resolveLocation("https://maps.app.goo.gl/abc")).point,
    ).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after five redirects, or when the network fails", async () => {
    const loop = vi.fn(async () => redirectTo("https://maps.app.goo.gl/again"));
    vi.stubGlobal("fetch", loop);
    expect(
      (await resolveLocation("https://maps.app.goo.gl/abc")).point,
    ).toBeNull();
    expect(loop).toHaveBeenCalledTimes(5);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await resolveLocation("https://maps.app.goo.gl/abc")).toEqual({
      point: null,
      link: "https://maps.app.goo.gl/abc",
    });
  });

  it("keeps a link without a position, so the admin can still open it", async () => {
    expect(
      await resolveLocation("https://www.google.com/maps/place/Some+Shop"),
    ).toEqual({
      point: null,
      link: "https://www.google.com/maps/place/Some+Shop",
    });
  });
});
