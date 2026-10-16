import { expect, test } from "@playwright/test";
import { db, freshRide, OWNER, RIDE, RIDER, signedIn, signIn } from "./support";

// An owner adds their UPI QR code; a rider with a seat in their car sees it, with the UPI ID,
// to pay after the ride.
test("riders see the owner's UPI ID and QR code to pay", async ({
  page,
  browser,
}) => {
  try {
    await signIn(page, OWNER.email);
    await page.goto("/profile");
    // Any real image will do as the "QR code": a corner of the page.
    const image = await page.screenshot({
      clip: { x: 0, y: 0, width: 160, height: 160 },
    });
    // The button waits until the page is ready, then opens the file picker.
    const picker = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add your QR code" }).click();
    await (
      await picker
    ).setFiles({ name: "qr.png", mimeType: "image/png", buffer: image });
    await expect(
      page.getByRole("img", { name: "Your UPI QR code" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // Seats are given out first come, so the rider's request is confirmed at once.
    await freshRide({ allocationInHours: -1 });
    const { error } = await db().rpc("request_seat", {
      p_rider_id: RIDER.id,
      p_ride_id: RIDE,
      p_pickup_seq: 0,
      p_drop_seq: 2,
    });
    if (error) throw error;

    const rider = await signedIn(browser, RIDER.email);
    await rider.goto(`/rides/${RIDE}`);
    await expect(
      rider.getByRole("heading", { name: "Your seat is confirmed" }),
    ).toBeVisible();
    await expect(rider.getByText("demo.owner@okdemo")).toBeVisible();
    const qr = rider.getByRole("img", { name: "Demo's UPI QR code" });
    await expect(qr).toBeVisible();
    // The image really loads (the rider is allowed to see the file).
    await expect
      .poll(() => qr.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await db().from("users").update({ upi_qr_path: null }).eq("id", OWNER.id);
    await freshRide();
  }
});
