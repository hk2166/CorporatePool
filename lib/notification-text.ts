// What each notification in the outbox says (F-E1, F-E2, F-E3). The database writes a kind and
// a few ids; the push sender turns them into words here. Kept free of I/O so it's easy to test.

import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { searchHref } from "@/lib/search-query";

export type Notification = { title: string; body: string; url: string };

type Payload = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

// "Sat, 17 Oct 08:00", from the ride's departure (looked up by the sender), or the payload.
function when(departAt: string | undefined): string {
  return departAt
    ? `${dayLabel(indiaDate(new Date(departAt)))} ${indiaTime(departAt)}`
    : "your ride";
}

export function notificationText(
  kind: string,
  payload: Payload,
  // The ride's departure time, when the payload names a ride.
  departAt?: string,
): Notification {
  const rideId = str(payload.ride_id);
  const url = rideId ? `/rides/${rideId}` : "/";
  const at = when(departAt ?? str(payload.depart_at));

  switch (kind) {
    case "booking_confirmed":
      return {
        title: "Seat confirmed",
        body: `${at}. Tap for the car and the owner's number.`,
        url,
      };
    case "booking_promoted":
      return {
        title: "You're in",
        body: `A seat came free for ${at}, and it's yours.`,
        url,
      };
    case "booking_moved":
      return payload.status === "REQUESTED"
        ? {
            title: "Asked for a seat in another car",
            body: `Your car can't take you, so you're in the queue for ${at} instead.`,
            url,
          }
        : {
            title: "Placed in another car",
            body: `Your car was full, so you have a seat for ${at} instead.`,
            url,
          };
    case "booking_waitlisted": {
      const rank = typeof payload.rank === "number" ? ` #${payload.rank}` : "";
      return {
        title: `Waitlisted${rank}`,
        body: `The car for ${at} is full. If a seat comes free, it's yours.`,
        url,
      };
    }
    case "request_withdrawn":
      return {
        title: "Request withdrawn",
        body: `You have a seat in another car around then, so your request for ${at} was withdrawn.`,
        url,
      };
    case "ride_cancelled": {
      const reason = str(payload.reason);
      return {
        title: "Ride cancelled",
        body:
          `The owner cancelled the ride for ${at}.` +
          (reason ? ` "${reason}"` : "") +
          (payload.finding_another_car
            ? " We're looking for another car for you."
            : ""),
        url,
      };
    }
    case "booking_ended":
      return {
        title: "No longer on this ride",
        body: payload.finding_another_car
          ? `You're no longer on ${at}. We're looking for another car for you.`
          : `You're no longer on ${at}. Find another seat any time.`,
        url: "/search",
      };
    case "booking_expired":
      return {
        title: "No seat this time",
        body: `The car for ${at} left without a free seat for you.`,
        url: "/search",
      };
    case "ride_started":
      return {
        title: "Your car is on its way",
        body: `The ride for ${at} has started. Be at your stop.`,
        url,
      };
    case "marked_no_show":
      return {
        title: "Marked as a no-show",
        body: "That costs 15 reliability points. If it's wrong, tell your group admin.",
        url: "/reliability",
      };
    case "ride_completed":
      return {
        title: "Thanks for riding",
        body: "+2 reliability. Don't forget to pay the owner.",
        url,
      };
    case "reminder":
      return {
        title: "Pickup in 15 minutes",
        body: str(payload.stop)
          ? `${str(payload.stop)} at ${indiaTime(str(payload.pickup_at) ?? departAt ?? new Date())}.`
          : `Your ride ${at}.`,
        url,
      };
    // To the owner.
    case "owner_reminder": {
      const riders = typeof payload.riders === "number" ? payload.riders : 0;
      return {
        title: "Time to set off soon",
        body: `Your ride leaves in about 15 minutes with ${riders} ${riders === 1 ? "rider" : "riders"}. Tap Start when you go.`,
        url,
      };
    }
    case "ride_full":
      return {
        title: "Your car is full",
        body: `Every seat for ${at} is taken.`,
        url,
      };
    case "booking_cancelled":
      return {
        title: "A rider dropped out",
        body: `A seat for ${at} came free. Anyone waiting gets it automatically.`,
        url,
      };
    case "ride_auto_live":
      return {
        title: "You're live for tomorrow",
        body: `Your usual ride for ${at} is up. Skip it if you're not driving.`,
        url,
      };
    // Route alerts: a car going the member's way (right away, or tomorrow's in a summary).
    case "ride_on_route": {
      const seats =
        typeof payload.seats_left === "number" ? payload.seats_left : null;
      const price = typeof payload.price === "number" ? payload.price : null;
      const details = [
        at,
        seats !== null && `${seats} ${seats === 1 ? "seat" : "seats"} left`,
        price !== null && `₹${price}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        title:
          payload.direction === "EVENING"
            ? "A car home on your route"
            : "A car to the office on your route",
        body: `${str(payload.from) ?? "Your stop"} → ${str(payload.to) ?? "your stop"}, ${details}. Tap to ask for a seat.`,
        url,
      };
    }
    case "route_digest": {
      const morning = typeof payload.morning === "number" ? payload.morning : 0;
      const evening = typeof payload.evening === "number" ? payload.evening : 0;
      const total = morning + evening;
      const home = str(payload.home);
      const work = str(payload.work);
      const date = str(payload.date) ?? indiaDate();
      const parts = [
        morning > 0 && `${morning} to the office`,
        evening > 0 && `${evening} home`,
      ].filter(Boolean);
      return {
        title: `${total} ${total === 1 ? "car" : "cars"} tomorrow on your route`,
        body: `${parts.join(", ")}. Tap to see them.`,
        // The morning ones if there are any, otherwise the evening ones.
        url:
          home && work
            ? searchHref({
                from: morning > 0 ? home : work,
                to: morning > 0 ? work : home,
                date,
                after: null,
                before: null,
                seats: 1,
              })
            : "/search",
      };
    }
    default:
      return {
        title: "CorporatePool",
        body: "Something changed on your ride.",
        url,
      };
  }
}
