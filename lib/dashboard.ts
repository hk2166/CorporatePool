// The maths behind the admin dashboard's charts (app/admin/dashboard): time ranges, axis
// scales, SVG paths and buckets. Charts draw in a 1000 × 100 box that's stretched to fit.

export const RANGES = [7, 14, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export function rangeDays(value: string | string[] | undefined): RangeDays {
  const n = Number(value);
  return RANGES.find((r) => r === n) ?? 30;
}

// The smallest of 1, 2, 5, 10, 20, 50, … that is at least x (and at least 1).
function niceStep(x: number): number {
  if (x <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(x));
  const multiple = [1, 2, 5].find((m) => m * magnitude >= x) ?? 10;
  return multiple * magnitude;
}

// A y axis for counts: whole-number ticks from 0, with the top as close above the largest
// value as 3 to 5 even steps allow.
export function axis(largest: number): { max: number; ticks: number[] } {
  const value = Math.max(0, largest);
  let best = { max: Infinity, segments: 4 };
  for (const segments of [3, 4, 5]) {
    const max = niceStep(value / segments) * segments;
    if (max < best.max) best = { max, segments };
  }
  const step = best.max / best.segments;
  return {
    max: best.max,
    ticks: Array.from({ length: best.segments + 1 }, (_, i) => i * step),
  };
}

// Where value i of n sits across the chart (the middle of its day), and how high.
function point(i: number, n: number, value: number, max: number) {
  const x = ((i + 0.5) * 1000) / n;
  const y = 100 - (Math.min(value, max) / max) * 100;
  return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
}

export function linePath(values: readonly number[], max: number): string {
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${point(i, values.length, v, max)}`)
    .join(" ");
}

// The line, closed down to the x axis, for a filled area under it.
export function areaPath(values: readonly number[], max: number): string {
  if (values.length === 0) return "";
  const n = values.length;
  const first = (0.5 * 1000) / n;
  const last = ((n - 0.5) * 1000) / n;
  return `${linePath(values, max)} L${Math.round(last * 10) / 10},100 L${Math.round(first * 10) / 10},100 Z`;
}

// Which of n days get a label under the chart: about `most` of them, evenly spread, always
// including the last (today).
export function labelledDays(n: number, most = 7): number[] {
  if (n <= most) return Array.from({ length: n }, (_, i) => i);
  const every = Math.ceil(n / most);
  const picked: number[] = [];
  for (let i = n - 1; i >= 0; i -= every) picked.unshift(i);
  return picked;
}

// Reliability scores (0–100) counted in five bands.
export const SCORE_BANDS = ["0–19", "20–39", "40–59", "60–79", "80–100"];
export function scoreBands(scores: readonly number[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const s of scores) {
    counts[Math.min(4, Math.max(0, Math.floor(s / 20)))]++;
  }
  return counts;
}

// Seats filled as a whole percentage of seats offered, or null when none were offered.
export function fillPercent(filled: number, offered: number): number | null {
  return offered > 0 ? Math.round((filled / offered) * 100) : null;
}

export function sum(values: readonly number[]): number {
  return values.reduce((n, v) => n + v, 0);
}
