import { describe, expect, it } from "vitest";
import { displayPhone } from "@/lib/contact-links";
import {
  canStartRide,
  ridersSummary,
  shownSince,
  splitRiders,
  stopAt,
  type RiderBooking,
} from "@/lib/my-riders";

const booking = (
  id: string,
  status: string,
  more: Partial<RiderBooking> = {},
): RiderBooking => ({
  id,
  rider_id: `rider-${id}`,
  status,
  seats: 1,
  waitlist_rank: null,
  pickup_seq: 0,
  drop_seq: 2,
  created_at: "2026-10-17T10:00:00Z",
  rider: { name: `Rider ${id}` },
  ...more,
});
const ids = (list: RiderBooking[]) => list.map((b) => b.id);

describe("splitRiders", () => {
  it("puts booked riders in pickup order, and the rest in queue order", () => {
    const { booked, asking, waitlisted } = splitRiders([
      booking("late-stop", "CONFIRMED", { pickup_seq: 1 }),
      booking("first-stop", "CONFIRMED", { pickup_seq: 0 }),
      booking("no-show", "NO_SHOW", { pickup_seq: 2 }),
      booking("asked-second", "REQUESTED", {
        created_at: "2026-10-17T11:00:00Z",
      }),
      booking("asked-first", "REQUESTED"),
      booking("wait-2", "WAITLISTED", { waitlist_rank: 2 }),
      booking("wait-1", "WAITLISTED", { waitlist_rank: 1 }),
      booking("gone", "CANCELLED"),
    ]);
    expect(ids(booked)).toEqual(["first-stop", "late-stop", "no-show"]);
    expect(ids(asking)).toEqual(["asked-first", "asked-second"]);
    expect(ids(waitlisted)).toEqual(["wait-1", "wait-2"]);
  });
});

describe("stopAt", () => {
  const stops = [
    { seq: 0, label: "Agra Chowk", eta_offset_min: 0 },
    { seq: 1, label: "Hudda Sector Cut", eta_offset_min: 35 },
  ];

  it("names the stop and when the car gets there, in India time", () => {
    // 02:30 UTC is 08:00 in India.
    expect(stopAt(stops, 1, "2026-10-19T02:30:00Z")).toBe(
      "Hudda Sector Cut · 08:35",
    );
  });

  it("still says something for a stop it doesn't know", () => {
    expect(stopAt(stops, 7, "2026-10-19T02:30:00Z")).toBe(
      "A stop on your route",
    );
  });
});

describe("ridersSummary", () => {
  it("counts riders booked, asking and waitlisted across the rides", () => {
    expect(
      ridersSummary([
        { bookings: [booking("a", "CONFIRMED"), booking("b", "REQUESTED")] },
        { bookings: [booking("c", "CONFIRMED"), booking("d", "WAITLISTED")] },
      ]),
    ).toBe(
      "2 riders booked on your 2 upcoming rides · 1 more asking for a seat · 1 waiting in line",
    );
  });

  it("says one rider and one ride in the singular", () => {
    expect(ridersSummary([{ bookings: [booking("a", "CONFIRMED")] }])).toBe(
      "1 rider booked on your 1 upcoming ride",
    );
  });

  it("says when nobody has booked yet", () => {
    expect(ridersSummary([{ bookings: [booking("x", "CANCELLED")] }])).toBe(
      "No bookings yet on your 1 upcoming ride.",
    );
  });
});

describe("shownSince", () => {
  it("reaches back four hours, so today's ride under way still shows", () => {
    expect(shownSince(new Date("2026-10-17T10:00:00Z"))).toBe(
      "2026-10-17T06:00:00.000Z",
    );
  });
});

describe("canStartRide", () => {
  const departAt = "2026-10-19T02:30:00Z";
  const at = (iso: string) => new Date(iso);

  it("opens an hour before the ride leaves", () => {
    expect(canStartRide(departAt, "OPEN", at("2026-10-19T01:29:00Z"))).toBe(
      false,
    );
    expect(canStartRide(departAt, "FULL", at("2026-10-19T01:30:00Z"))).toBe(
      true,
    );
  });

  it("is over once the ride is under way", () => {
    expect(canStartRide(departAt, "STARTED", at("2026-10-19T02:30:00Z"))).toBe(
      false,
    );
  });
});

describe("displayPhone", () => {
  it("spaces an Indian mobile number the way people write it", () => {
    expect(displayPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("leaves any other number as it is", () => {
    expect(displayPhone("+4420794600")).toBe("+4420794600");
  });
});
