"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type RiderActionState = {
  error?: string;
  // Echoed back so the form keeps what the rider picked after an error.
  values?: { pickup: string; drop: string; seats: string; anyCarOk: boolean };
};

// What request_seat() means by each refusal, in the rider's words.
const REQUEST_ERRORS: Record<string, string> = {
  NO_PHONE:
    "Add your mobile number on your profile first: the owner calls you on it.",
  OWN_RIDE: "This is your own ride.",
  NOT_BOOKABLE: "This ride isn't taking requests any more.",
  WOMEN_ONLY: "This ride is for women only.",
  BAD_SEATS: "Choose how many seats you need.",
  BAD_STOPS: "Pick a pickup stop that comes before your drop stop.",
  ALREADY_REQUESTED: "You've already asked for a seat on this ride.",
  ALREADY_BOOKED: "You already have a seat in a car around this time.",
};

// Asks for a seat (F-D1, user flow 1 step 5). request_seat() decides what happens: queued until
// 22:00, confirmed, or waitlisted (T-5.1).
export async function requestSeat(
  _previous: RiderActionState,
  formData: FormData,
): Promise<RiderActionState> {
  // Server Actions can be called by a direct POST, so check who's asking every time.
  const user = await getCurrentUser();
  const values = {
    pickup: String(formData.get("pickup") ?? ""),
    drop: String(formData.get("drop") ?? ""),
    seats: String(formData.get("seats") ?? "1"),
    anyCarOk: formData.get("anyCarOk") === "on",
  };

  const { error } = await createAdminClient().rpc("request_seat", {
    p_rider_id: user.id,
    p_ride_id: String(formData.get("rideId") ?? ""),
    p_pickup_seq: Number(values.pickup),
    p_drop_seq: Number(values.drop),
    p_seats: Number(values.seats),
    p_any_car_ok: values.anyCarOk,
  });
  if (error) {
    return {
      error:
        (error.hint && REQUEST_ERRORS[error.hint]) ??
        "Couldn't ask for the seat. Please try again.",
      values,
    };
  }
  refresh();
  return {};
}

// Drops a request, a waitlist place or a confirmed seat (F-D7, user flow 5). A confirmed seat
// goes straight to the next rider waiting (T-5.3).
export async function cancelBooking(
  _previous: RiderActionState,
  formData: FormData,
): Promise<RiderActionState> {
  const user = await getCurrentUser();
  const { error } = await createAdminClient().rpc("cancel_booking", {
    p_rider_id: user.id,
    p_booking_id: String(formData.get("bookingId") ?? ""),
  });
  if (error) {
    return {
      error:
        error.hint === "NOT_CANCELLABLE"
          ? "This can no longer be cancelled."
          : "Couldn't cancel. Please try again.",
    };
  }
  refresh();
  return {};
}
