// How a member mostly uses CorporatePool (users.ride_preference): asked once on /welcome,
// changed on the profile page. It decides what the home page puts first, nothing more.

export const RIDE_PREFERENCES = [
  {
    value: "RIDER",
    title: "I'm looking for a ride",
    detail: "Find seats in cars going your way.",
  },
  {
    value: "DRIVER",
    title: "I drive and have seats to share",
    detail: "Offer your empty seats to people on your route.",
  },
  {
    value: "BOTH",
    title: "Both",
    detail: "Some days I drive, some days I ride.",
  },
] as const;

export type RidePreference = (typeof RIDE_PREFERENCES)[number]["value"];

export function parseRidePreference(value: unknown): RidePreference | null {
  return RIDE_PREFERENCES.some((p) => p.value === value)
    ? (value as RidePreference)
    : null;
}

// What the home page shows, in order: riding things, driving things, or both. Members who
// haven't answered see both, riding first, as before.
export function homeSections(
  preference: RidePreference | null,
): ("riding" | "driving")[] {
  switch (preference) {
    case "RIDER":
      return ["riding"];
    case "DRIVER":
      return ["driving", "riding"];
    default:
      return ["riding", "driving"];
  }
}

// Car owners are members who said they drive (or both). Only they get the Car and Offer
// pages in the menu; everyone else sees Find and Profile.
export function isCarOwner(preference: RidePreference | null): boolean {
  return preference === "DRIVER" || preference === "BOTH";
}
