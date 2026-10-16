import { parseCoordinates } from "@/lib/coordinates";

// Reads a position from what people paste when adding or requesting a stop: coordinates
// ("28.1440, 77.3290") or a Google Maps link. Full links carry the position in the address;
// short ones (maps.app.goo.gl/…) only after they're followed, which the server does
// (lib/resolve-location.ts).

export type Point = { lat: number; lng: number };

const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

function point(lat: number, lng: number): Point | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function isGoogleMapsUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return (
    /^maps\.google\.[a-z.]+$/.test(host) ||
    (/^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps"))
  );
}

// Short links that redirect to a Google Maps address.
export function isShortMapsLink(text: string): boolean {
  try {
    const url = new URL(text.trim());
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "maps.app.goo.gl" ||
        (host === "goo.gl" && url.pathname.startsWith("/maps")))
    );
  } catch {
    return false;
  }
}

// The position in pasted text, or null. Google Maps addresses can hold more than one: the
// dropped pin or place (!3d…!4d…, /search/lat,lng, ?q=lat,lng) is preferred over the middle
// of the map view (@lat,lng).
export function pointFromText(text: string): Point | null {
  const trimmed = text.trim();
  const plain = parseCoordinates(trimmed);
  if (plain) return plain;

  const geo = trimmed.match(new RegExp(String.raw`^geo:${NUMBER},${NUMBER}`));
  if (geo) return point(Number(geo[1]), Number(geo[2]));

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!isGoogleMapsUrl(url)) return null;
  const address = decodeURIComponent(url.pathname + url.search).replace(
    /\+/g,
    " ",
  );

  const pin = address.match(new RegExp(String.raw`!3d${NUMBER}!4d${NUMBER}`));
  if (pin) return point(Number(pin[1]), Number(pin[2]));

  const search = address.match(
    new RegExp(String.raw`/maps/(?:search|place|dir)/${NUMBER},\s*${NUMBER}`),
  );
  if (search) return point(Number(search[1]), Number(search[2]));

  for (const key of ["q", "query", "ll", "center", "destination", "daddr"]) {
    const value = url.searchParams.get(key);
    const found = value ? parseCoordinates(value.replace(/\+/g, " ")) : null;
    if (found) return found;
  }

  const view = address.match(new RegExp(String.raw`@${NUMBER},${NUMBER}`));
  if (view) return point(Number(view[1]), Number(view[2]));
  return null;
}

// A link worth keeping with a request, so the admin can open it: http(s), at most 500 long.
export function cleanLink(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
