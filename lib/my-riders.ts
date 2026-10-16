// The owner's riders page (/my-riders): who has booked each of their upcoming rides, where
// they get in and out, and who's still waiting for a seat. Free of I/O, so it's easy to test.

import { indiaTime } from "@/lib/india-time";

export type RiderBooking = {
  id: string;
  rider_id: string;
  status: string;
  seats: number;
  waitlist_rank: number | null;
  pickup_seq: number;
  drop_seq: number;
  created_at: string;
  rider: { name: string } | null;
};
export type RideStop = { seq: number; label: string; eta_offset_min: number };

// The rides on the page: still to come, or under way. One that left in the last few hours is
// still today's ride, as on the home page.
export const SHOWN_STATUSES = [
  "OPEN",
  "ALLOCATING",
  "FULL",
  "STARTED",
] as const;
export function shownSince(now = new Date()): string {
  return new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
}

// The owner can start a ride from an hour before it leaves (start_ride says the same).
export function canStartRide(
  departAt: string,
  status: string,
  now = new Date(),
): boolean {
  return (
    ["OPEN", "ALLOCATING", "FULL"].includes(status) &&
    now.getTime() >= new Date(departAt).getTime() - 60 * 60 * 1000
  );
}

// Booked: a confirmed seat (or marked a no-show on the day), in pickup order. Asking: seats
// aren't handed out yet, first asked first. Waitlisted: in waitlist order.
export function splitRiders<T extends RiderBooking>(bookings: readonly T[]) {
  const byTime = (a: T, b: T) => a.created_at.localeCompare(b.created_at);
  const booked = bookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "NO_SHOW")
    .sort((a, b) => a.pickup_seq - b.pickup_seq || byTime(a, b));
  const asking = bookings.filter((b) => b.status === "REQUESTED").sort(byTime);
  const waitlisted = bookings
    .filter((b) => b.status === "WAITLISTED")
    .sort((a, b) => (a.waitlist_rank ?? 0) - (b.waitlist_rank ?? 0));
  return { booked, asking, waitlisted };
}

// "Demo Stop 09 · 08:35": a stop of the ride, and when the car gets there.
export function stopAt(
  stops: readonly RideStop[],
  seq: number,
  departAt: string,
): string {
  const stop = stops.find((s) => s.seq === seq);
  if (!stop) return "A stop on your route";
  const at = new Date(departAt).getTime() + stop.eta_offset_min * 60_000;
  return `${stop.label} · ${indiaTime(new Date(at))}`;
}

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// The line at the top: "3 riders booked on your 2 upcoming rides · 1 more asking for a seat".
export function ridersSummary(
  rides: readonly { bookings: readonly RiderBooking[] }[],
): string {
  const all = rides.map((r) => splitRiders(r.bookings));
  const booked = all.reduce((n, r) => n + r.booked.length, 0);
  const asking = all.reduce((n, r) => n + r.asking.length, 0);
  const waitlisted = all.reduce((n, r) => n + r.waitlisted.length, 0);
  const onRides = `on your ${count(rides.length, "upcoming ride", "upcoming rides")}`;
  if (booked + asking + waitlisted === 0) return `No bookings yet ${onRides}.`;
  return [
    `${count(booked, "rider", "riders")} booked ${onRides}`,
    asking > 0 && `${asking} more asking for a seat`,
    waitlisted > 0 && `${waitlisted} on the waitlist`,
  ]
    .filter(Boolean)
    .join(" · ");
}
