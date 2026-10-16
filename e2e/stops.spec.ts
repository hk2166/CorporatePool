import { expect, test } from "@playwright/test";
import { db, RIDER, SECOND, signedIn } from "./support";

// A member asks for a stop with a Google Maps link; an admin adds it from Admin → Stops; then
// everyone can pick it.
test("a member requests a stop and an admin adds it", async ({ browser }) => {
  const name = `Demo Requested Corner ${Date.now()}`;
  try {
    const rider = await signedIn(browser, RIDER.email);
    await rider.goto("/profile");
    await rider.getByRole("link", { name: "Request a stop" }).click();
    await expect(
      rider.getByRole("heading", { name: "Request a stop" }),
    ).toBeVisible();
    await rider.getByLabel("Name").fill(name);
    await rider
      .getByLabel(/Google Maps link/)
      .fill(
        "https://www.google.com/maps/search/28.150500,+77.310500?entry=tts",
      );
    await rider.getByRole("button", { name: "Send request" }).click();
    await expect(rider).toHaveURL(/\/profile\?stopRequested=1/);
    await expect(
      rider.getByText("Thanks! An admin will add your stop soon."),
    ).toBeVisible();

    const admin = await signedIn(browser, SECOND.email);
    await admin.goto("/admin/stops");
    await expect(admin.getByLabel(`Where ${name} is`)).toHaveValue(
      "28.15050, 77.31050",
    );
    await admin.getByRole("button", { name: `Add ${name}` }).click();
    // Added: the request leaves the waiting list and the stop joins the list.
    await expect(admin.getByLabel(`Where ${name} is`)).toHaveCount(0);
    await expect(admin.locator("summary", { hasText: name })).toBeVisible();

    await rider.goto("/search");
    await expect(rider.locator("#from option", { hasText: name })).toHaveCount(
      1,
    );
  } finally {
    const d = db();
    await d.from("stop_requests").delete().eq("name", name);
    await d.from("places").delete().eq("name", name);
  }
});
