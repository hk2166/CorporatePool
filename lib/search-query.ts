// The search screen's question (F-C1), read from the URL so a search can be bookmarked, shared
// and reloaded: /search?from=<place>&to=<place>&date=2026-10-17&after=07:00&before=09:00&seats=1

import { addDays, dayLabel } from "@/lib/india-time";

export type SearchQuery = {
  from: string | null; // place ids
  to: string | null;
  date: string; // YYYY-MM-DD in India
  after: string | null; // "07:00": the car reaches the pickup stop from then…
  before: string | null; // …until then. null = no limit
  seats: number;
};

// How far ahead rides can be searched. Rides go live the evening before, so a week is plenty.
export const DAYS_AHEAD = 6;
export const MAX_SEATS = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = /^([01]\d|2[0-3]):00$/;

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Anything missing or odd falls back to a sensible default instead of an error: tomorrow, any
// time, one seat.
export function parseSearchQuery(params: Params, today: string): SearchQuery {
  const from = one(params.from);
  const to = one(params.to);
  const date = one(params.date);
  let after = one(params.after);
  let before = one(params.before);
  const seats = Number(one(params.seats));

  if (!after || !HOUR.test(after)) after = undefined;
  if (!before || !HOUR.test(before)) before = undefined;
  // "9 to 7" means "7 to 9".
  if (after && before && before < after) [after, before] = [before, after];

  return {
    from: from && UUID.test(from) ? from.toLowerCase() : null,
    to: to && UUID.test(to) ? to.toLowerCase() : null,
    date:
      date &&
      DATE.test(date) &&
      date >= today &&
      date <= addDays(today, DAYS_AHEAD)
        ? date
        : addDays(today, 1),
    after: after ?? null,
    before: before ?? null,
    seats:
      Number.isInteger(seats) && seats >= 1 && seats <= MAX_SEATS ? seats : 1,
  };
}

// The window as search_rides() takes it. "08:00 to 09:00" includes a car at 09:00 sharp; one
// hour like "08:00 to 08:00" means that hour.
export function timeWindow(query: SearchQuery): { from: string; to: string } {
  const from = query.after ?? "00:00";
  if (!query.before) return { from, to: "23:59:59" };
  if (query.before === query.after) {
    return { from, to: `${query.after.slice(0, 2)}:59:59` };
  }
  return { from, to: query.before };
}

// The URL for a search, leaving out what's at its default.
export function searchHref(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("date", query.date);
  if (query.after) params.set("after", query.after);
  if (query.before) params.set("before", query.before);
  if (query.seats !== 1) params.set("seats", String(query.seats));
  return `/search?${params}`;
}

// The days to pick from: Today, Tomorrow, then "Sun 19 Oct" and so on.
export function dayChoices(today: string): { value: string; label: string }[] {
  return Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => {
    const value = addDays(today, i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayLabel(value);
    return { value, label };
  });
}

// "at the stop", "350 m walk", "1.2 km walk".
export function walkLabel(metres: number): string {
  if (metres < 100) return "at the stop";
  const rounded = Math.round(metres / 50) * 50;
  if (rounded < 1000) return `${rounded} m walk`;
  return `${(metres / 1000).toFixed(1)} km walk`;
}
