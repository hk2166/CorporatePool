// The reliability score (F-F3, lld.md §3), as the app explains it. The database computes the
// real number (private.reliability_score in supabase/migrations/*_reliability_score.sql); this
// mirrors it so the "how the score works" page and its examples can't drift from it. The unit
// tests pin both to the same cases.

export const SCORE_RULES = {
  start: 50,
  perRide: 2,
  maxFromRides: 40,
  noShow: -15,
  lateCancel: -5,
  windowDays: 90,
  min: 0,
  max: 100,
} as const;

export type ScoreInputs = {
  ridesCompleted: number; // all time
  noShows: number; // in the last 90 days
  lateCancels: number; // in the last 90 days
};

export function reliabilityScore({
  ridesCompleted,
  noShows,
  lateCancels,
}: ScoreInputs): number {
  const r = SCORE_RULES;
  const raw =
    r.start +
    Math.min(r.perRide * ridesCompleted, r.maxFromRides) +
    r.noShow * noShows +
    r.lateCancel * lateCancels;
  return Math.max(r.min, Math.min(r.max, raw));
}

export type EventKind =
  "COMPLETED" | "NO_SHOW" | "LATE_CANCEL" | "OWNER_LATE_CANCEL";

// What each event in someone's history means, in their words.
export const EVENT_LABEL: Record<EventKind, string> = {
  COMPLETED: "Ride completed",
  NO_SHOW: "Didn't turn up",
  LATE_CANCEL: "Cancelled a confirmed seat after 10 pm the night before",
  OWNER_LATE_CANCEL: "Cancelled a booked ride after 10 pm the night before",
};

// Whether an event still counts: completed rides always do; misses for 90 days.
export function eventCounts(
  kind: EventKind,
  createdAt: Date | string,
  now: Date = new Date(),
): boolean {
  if (kind === "COMPLETED") return true;
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs < SCORE_RULES.windowDays * 24 * 60 * 60 * 1000;
}
