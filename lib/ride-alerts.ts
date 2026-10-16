// Route alerts (users.ride_alerts): how a member hears about cars going their way. The
// database matches cars to their home and office stops, both ways (run_route_alerts,
// run_route_digest); this is the choice, in their words.

export const RIDE_ALERTS = [
  {
    value: "INSTANT",
    title: "Right away",
    detail: "A notification as soon as a car on your route goes live.",
  },
  {
    value: "DIGEST",
    title: "Once a day, at 8 pm",
    detail: "One summary of tomorrow's cars on your route.",
  },
  {
    value: "OFF",
    title: "Off",
    detail: "No alerts. You can still search any time.",
  },
] as const;

export type RideAlerts = (typeof RIDE_ALERTS)[number]["value"];

export function parseRideAlerts(value: unknown): RideAlerts {
  return RIDE_ALERTS.some((a) => a.value === value)
    ? (value as RideAlerts)
    : "INSTANT";
}
