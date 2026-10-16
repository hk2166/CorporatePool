// Rules for the usual ride an owner saves once (F-B1, F-B3). The database checks the basics
// (2–12 stops, 1–7 seats, weekdays as a 7-bit mask); these give clear messages and check what
// spans several fields.

// Weekdays as bits, Monday first: usual_rides.auto_golive_days stores their sum.
export const WEEKDAYS = [
  { bit: 1, short: "Mon" },
  { bit: 2, short: "Tue" },
  { bit: 4, short: "Wed" },
  { bit: 8, short: "Thu" },
  { bit: 16, short: "Fri" },
  { bit: 32, short: "Sat" },
  { bit: 64, short: "Sun" },
] as const;

export function weekdaysToMask(bits: number[]): number {
  return WEEKDAYS.reduce(
    (mask, day) => (bits.includes(day.bit) ? mask | day.bit : mask),
    0,
  );
}

export type StopInput = { placeId: string; etaOffsetMin: number };

export const MAX_STOPS = 12;
// A stop can be at most 10 hours after departure (ride_stops.eta_offset_min).
export const MAX_ETA_MIN = 600;

// Returns what's wrong with the stops, or null if they're fine.
export function checkStops(stops: StopInput[]): string | null {
  if (stops.length < 2) return "Add at least a start and an end stop.";
  if (stops.length > MAX_STOPS) return `At most ${MAX_STOPS} stops.`;
  if (stops.some((s) => !s.placeId)) return "Pick a place for every stop.";
  if (new Set(stops.map((s) => s.placeId)).size !== stops.length) {
    return "Each stop can appear only once.";
  }
  if (stops[0].etaOffsetMin !== 0)
    return "The first stop is where you set off.";
  for (let i = 1; i < stops.length; i++) {
    const minutes = stops[i].etaOffsetMin;
    if (!Number.isInteger(minutes) || minutes > MAX_ETA_MIN) {
      return "Times must be whole minutes, at most 600 after setting off.";
    }
    if (minutes <= stops[i - 1].etaOffsetMin) {
      return "Each stop must come later than the one before it.";
    }
  }
  return null;
}

// "08:05" → "08:05"; anything that isn't a 24-hour HH:MM time → null.
export function parseDepartTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

// The weekday bit for a YYYY-MM-DD date (Mon = 1 … Sun = 64).
export function weekdayBit(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const sundayFirst = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return 1 << ((sundayFirst + 6) % 7);
}

// "every day", "Mon–Fri", "weekends", or a list like "Mon, Wed, Fri".
export function describeWeekdays(mask: number): string {
  if (mask === 127) return "every day";
  if (mask === 31) return "Mon–Fri";
  if (mask === 96) return "weekends";
  return WEEKDAYS.filter((day) => mask & day.bit)
    .map((day) => day.short)
    .join(", ");
}
