// Words for a ride's public card: the page behind a shared WhatsApp link, its preview image and
// the share message (F-H1). Only uses what get_public_ride() exposes.

import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";

export type PublicStop = { seq: number; label: string; eta_offset_min: number };

export type PublicRide = {
  ride_id: string;
  depart_at: string;
  price_per_seat: number;
  seats_left: number;
  status: string;
  women_only: boolean;
  owner_first_name: string;
  stops: PublicStop[];
};

// "Demo Palwal Start → Demo Cyber City"
export function routeSummary(stops: PublicStop[]): string {
  if (stops.length === 0) return "A shared ride";
  const ordered = [...stops].sort((a, b) => a.seq - b.seq);
  return `${ordered[0].label} → ${ordered[ordered.length - 1].label}`;
}

// "2 seats", "1 seat", "Full", "Cancelled"
export function seatsSummary(
  ride: Pick<PublicRide, "seats_left" | "status">,
): string {
  if (ride.status === "CANCELLED") return "Cancelled";
  if (ride.status === "COMPLETED" || ride.status === "STARTED")
    return "Already left";
  if (ride.seats_left === 0 || ride.status === "FULL") return "Full";
  return `${ride.seats_left} seat${ride.seats_left === 1 ? "" : "s"}`;
}

// "Sat, 17 Oct · 08:00"
export function whenSummary(departAt: string): string {
  return `${dayLabel(indiaDate(new Date(departAt)))} · ${indiaTime(departAt)}`;
}

// "Demo Palwal Start → Demo Cyber City · Sat, 17 Oct · 08:00 · 2 seats · ₹150"
export function cardLine(ride: PublicRide): string {
  return [
    routeSummary(ride.stops),
    whenSummary(ride.depart_at),
    seatsSummary(ride),
    `₹${ride.price_per_seat}`,
  ].join(" · ");
}

// The WhatsApp message: the card line, then the link.
export function shareMessage(ride: PublicRide, url: string): string {
  return `${cardLine(ride)}\n${url}`;
}
