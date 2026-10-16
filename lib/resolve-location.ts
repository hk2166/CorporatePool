import "server-only";
import {
  cleanLink,
  isShortMapsLink,
  pointFromText,
  type Point,
} from "@/lib/maps-link";

// Google's own addresses: the only places a short link is followed to.
const GOOGLE_HOST =
  /^(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+|consent\.google\.com)$/i;
const MAX_HOPS = 5;

export type Location = { point: Point | null; link: string | null };

// What someone pasted, read as a position, plus the link itself when it is one (kept with a
// stop request so the admin can open it). Coordinates and full Google Maps links are read
// directly. A short link (maps.app.goo.gl/…) is followed through Google's redirects until an
// address with the position turns up: at most 5 redirects, 5 seconds each, and never to
// anywhere but Google.
export async function resolveLocation(text: string): Promise<Location> {
  const trimmed = text.trim();
  if (!trimmed) return { point: null, link: null };
  const link = cleanLink(trimmed);
  const direct = pointFromText(trimmed);
  if (direct || !isShortMapsLink(trimmed)) return { point: direct, link };

  let current = trimmed;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; CorporatePool)" },
      });
    } catch {
      break;
    }
    const location = response.headers.get("location");
    if (!location) break;
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      break;
    }
    if (next.protocol !== "https:" || !GOOGLE_HOST.test(next.hostname)) break;
    const found = pointFromText(next.toString());
    if (found) return { point: found, link };
    current = next.toString();
  }
  return { point: null, link };
}
