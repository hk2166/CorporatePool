// Which town a stop is in, worked out from where it is, so the stop pickers can group stops by
// town ("Palwal: Agra Chowk, …"). Stops added later fall into place by themselves.
//
// Town centres are from OpenStreetMap (16 Oct 2026). Each town also has a rough size: a stop
// belongs to the town it sits most deeply inside (distance ÷ size), so a stop on Gurugram's
// southern edge counts as Gurugram, not the small town of Sohna that is a little nearer.

export type City = { name: string; lat: number; lng: number; radiusKm: number };

// South to north, the way the corridor runs and the lists read.
export const CITIES: readonly City[] = [
  { name: "Hodal", lat: 27.89992, lng: 77.37393, radiusKm: 8 },
  { name: "Hathin", lat: 28.03539, lng: 77.22432, radiusKm: 6 },
  { name: "Palwal", lat: 28.14057, lng: 77.32598, radiusKm: 10 },
  { name: "Sohna", lat: 28.32416, lng: 77.08486, radiusKm: 6 },
  { name: "Manesar", lat: 28.32471, lng: 76.92638, radiusKm: 7 },
  { name: "Ballabhgarh", lat: 28.34, lng: 77.31645, radiusKm: 6 },
  { name: "Faridabad", lat: 28.40315, lng: 77.31056, radiusKm: 10 },
  { name: "Gurugram", lat: 28.46461, lng: 77.02992, radiusKm: 15 },
  { name: "Noida", lat: 28.57063, lng: 77.32721, radiusKm: 12 },
  { name: "Delhi", lat: 28.6139, lng: 77.20901, radiusKm: 20 },
];

export const OTHER_CITY = "Other places";

// Great-circle distance in kilometres.
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function cityOf(point: { lat: number; lng: number }): string {
  let best: { name: string; depth: number } | null = null;
  for (const city of CITIES) {
    const depth = distanceKm(point, city) / city.radiusKm;
    if (depth <= 1 && (!best || depth < best.depth)) {
      best = { name: city.name, depth };
    }
  }
  return best?.name ?? OTHER_CITY;
}

// Stops grouped by town, towns south to north and "Other places" last; stops keep the order
// they came in (the stop list is already south to north).
export function groupByCity<T extends { lat: number; lng: number }>(
  places: readonly T[],
): { city: string; places: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const place of places) {
    const city = cityOf(place);
    groups.set(city, [...(groups.get(city) ?? []), place]);
  }
  const order = [...CITIES.map((c) => c.name), OTHER_CITY];
  return order
    .filter((city) => groups.has(city))
    .map((city) => ({ city, places: groups.get(city) ?? [] }));
}
