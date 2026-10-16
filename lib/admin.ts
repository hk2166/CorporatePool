// Small helpers for the admin pages (app/admin): ordering the members list, and the wording
// for "last seen" and percentages.

export type MemberRow = {
  name: string;
  reliability_score: number;
  rides_offered: number;
  rides_taken: number;
  active_days_30: number;
  last_active: string | null; // YYYY-MM-DD in India
  joined_at: string;
};

export const MEMBER_SORTS = [
  { key: "joined", label: "Newest" },
  { key: "active", label: "Most active" },
  { key: "driven", label: "Most rides offered" },
  { key: "taken", label: "Most rides taken" },
  { key: "score", label: "Reliability" },
  { key: "name", label: "Name" },
] as const;
export type MemberSort = (typeof MEMBER_SORTS)[number]["key"];

export function memberSort(value: string | string[] | undefined): MemberSort {
  return MEMBER_SORTS.some((s) => s.key === value)
    ? (value as MemberSort)
    : "joined";
}

// A new, sorted copy. Ties fall back to the name, so the order is the same on every load.
export function sortMembers<T extends MemberRow>(
  rows: readonly T[],
  sort: MemberSort,
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const most = (f: (r: T) => number) => (a: T, b: T) =>
    f(b) - f(a) || byName(a, b);
  const compare: Record<MemberSort, (a: T, b: T) => number> = {
    joined: (a, b) => b.joined_at.localeCompare(a.joined_at) || byName(a, b),
    active: (a, b) =>
      b.active_days_30 - a.active_days_30 ||
      (b.last_active ?? "").localeCompare(a.last_active ?? "") ||
      byName(a, b),
    driven: most((r) => r.rides_offered),
    taken: most((r) => r.rides_taken),
    score: most((r) => r.reliability_score),
    name: byName,
  };
  return [...rows].sort(compare[sort]);
}

// "Today", "Yesterday", "5 days ago" or "Never", from the last day someone opened the app.
export function lastSeen(lastActive: string | null, today: string): string {
  if (!lastActive) return "Never";
  const days = Math.round(
    (Date.parse(today) - Date.parse(lastActive)) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

// "67%", or "–" when there's nothing to divide by.
export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

// Rides still to leave (soonest first) and rides that have left (latest first), from a list
// ordered latest first.
export function splitByDeparture<T extends { depart_at: string }>(
  rides: readonly T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const left = (r: T) => Date.parse(r.depart_at) < now.getTime();
  return {
    upcoming: rides.filter((r) => !left(r)).reverse(),
    past: rides.filter(left),
  };
}
