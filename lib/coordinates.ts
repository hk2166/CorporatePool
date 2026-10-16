// Reads a point the way Google Maps copies it: "28.1440, 77.3290" (latitude, longitude).
// Used by the admin stop list (T-7.3). Returns null for anything else.
export function parseCoordinates(
  text: string,
): { lat: number; lng: number } | null {
  const match = text
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// "28.14400, 77.32900": five decimals is about a metre.
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
