// The suggested price per seat (F-B6, Q5): the car's running cost for the trip, shared
// between the driver and the seats offered. The owner sets the real price; this keeps it
// close to cost-sharing (D1). Rough on purpose: it's a starting point, not a fare meter.

export type LatLng = { lat: number; lng: number };

// ₹ per km to run a typical hatchback or sedan: petrol at about ₹100/L and 15 km/L, plus a
// little for wear.
export const COST_PER_KM = 7;
// Roads are longer than straight lines between stops.
export const ROAD_FACTOR = 1.3;

// Straight-line distance in km (haversine).
export function straightLineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Estimated road distance along the stops, in km.
export function routeKm(stops: LatLng[]): number {
  let km = 0;
  for (let i = 1; i < stops.length; i++) {
    km += straightLineKm(stops[i - 1], stops[i]);
  }
  return km * ROAD_FACTOR;
}

// Rounded to the nearest ₹10, and never below ₹10.
export function suggestedPricePerSeat(
  stops: LatLng[],
  seatsOffered: number,
): number {
  if (stops.length < 2 || seatsOffered < 1) return 0;
  const perPerson = (routeKm(stops) * COST_PER_KM) / (seatsOffered + 1);
  return Math.max(10, Math.round(perPerson / 10) * 10);
}
