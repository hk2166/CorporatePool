import { expect, test } from "@playwright/test";
import { db, freshRide, OWNER, RIDE, RIDER, signIn } from "./support";

// The owner's Riders page: who has booked, where they get in and out, and their number once
// their seat is confirmed.
test("an owner sees who has booked their ride", async ({ page }) => {
  try {
    await freshRide();
    const d = db();
    // The rider asks for a seat from the first stop to the last, and gets it straight away.
    const { error } = await d.rpc("request_seat", {
      p_rider_id: RIDER.id,
      p_ride_id: RIDE,
      p_pickup_seq: 0,
      p_drop_seq: 2,
    });
    if (error) throw error;

    await signIn(page, OWNER.email);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Riders" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your riders" }),
    ).toBeVisible();
    const ride = page.getByRole("region", { name: /^Tomorrow · / });
    await expect(
      page.getByText("1 rider booked on your 1 upcoming ride"),
    ).toBeVisible();
    await expect(
      ride.getByRole("heading", { name: "Booked (1)" }),
    ).toBeVisible();
    await expect(
      ride.getByText(/Gets in at Demo Palwal Start · \d\d:\d\d/),
    ).toBeVisible();
    await expect(
      ride.getByText(/Gets out at Demo Cyber City · \d\d:\d\d/),
    ).toBeVisible();
    await expect(ride.getByText("+91 99999 00002")).toBeVisible();
    await expect(ride.getByRole("link", { name: "Call" })).toHaveAttribute(
      "href",
      "tel:+919999900002",
    );
  } finally {
    await freshRide();
  }
});
