import { dayLabel, indiaTime } from "@/lib/india-time";

// "Tomorrow's rides" for the WhatsApp group: the message an admin pastes into the group each
// evening, so people who still live in WhatsApp hear about every car and book in the app. Each
// ride links to its public page (/r/…), which shows the route, time, seats, price and the
// driver's first name, and nothing that identifies or contacts anyone.

export type SummaryRide = {
  id: string;
  departAt: string; // ISO
  stops: string[]; // in order
  seatsLeft: number;
  price: number;
  driver: string; // full name; only the first name is shown
};

// Before noon is the run to the office; after it, the way home.
function isMorning(departAt: string): boolean {
  return indiaTime(departAt) < "12:00";
}

function rideLine(ride: SummaryRide, site: string): string {
  const first = ride.stops[0] ?? "Start";
  const last = ride.stops.at(-1) ?? "End";
  const middle = ride.stops.slice(1, -1);
  const via =
    middle.length === 0
      ? ""
      : ` (via ${middle.slice(0, 2).join(", ")}${middle.length > 2 ? "…" : ""})`;
  const seats = `${ride.seatsLeft} ${ride.seatsLeft === 1 ? "seat" : "seats"}`;
  const driver = ride.driver.split(" ")[0];
  return (
    `• ${indiaTime(ride.departAt)} ${first} → ${last}${via} · ${seats} · ₹${ride.price} · ${driver}\n` +
    `  ${site}/r/${ride.id}`
  );
}

export function whatsappSummary({
  day,
  label,
  rides,
  site,
}: {
  day: string; // YYYY-MM-DD in India
  label: string; // "Tomorrow" or "Today"
  rides: readonly SummaryRide[];
  site: string;
}): string {
  const heading = `🚗 Rides ${label.toLowerCase()}, ${dayLabel(day)}, on CorporatePool`;
  const footer = `Ask for a seat in the app: ${site}`;
  if (rides.length === 0) {
    return `${heading}\n\nNo cars yet. Driving? Offer your seats in the app.\n\n${footer}`;
  }
  const sorted = [...rides].sort((a, b) =>
    a.departAt.localeCompare(b.departAt),
  );
  const morning = sorted.filter((r) => isMorning(r.departAt));
  const evening = sorted.filter((r) => !isMorning(r.departAt));
  const sections = [
    morning.length > 0 &&
      `*Morning*\n${morning.map((r) => rideLine(r, site)).join("\n")}`,
    evening.length > 0 &&
      `*Evening*\n${evening.map((r) => rideLine(r, site)).join("\n")}`,
  ].filter(Boolean);
  return `${heading}\n\n${sections.join("\n\n")}\n\n${footer}`;
}

// Opens WhatsApp (the app on a phone, WhatsApp Web on a computer) with the message ready to
// send to a chat or group of the admin's choosing.
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
