import { expect, test } from "@playwright/test";
import { db, OWNER, signIn } from "./support";

// An owner's evening ride home: it starts as the morning route in reverse, and once saved the
// home page offers it.
test("an owner sets up the evening ride home", async ({ page }) => {
  try {
    await signIn(page, OWNER.email);
    await page.goto("/usual-ride#evening");
    const evening = page.getByRole("region", {
      name: "Evening: office → home",
    });
    await expect(
      evening.getByLabel("Pickup spot 1").locator("option:checked"),
    ).toHaveText("Demo Cyber City");
    // Where the morning ride dropped people, the evening one picks them up, and the other
    // way round.
    await expect(
      evening.getByLabel("Pickup spot 2").locator("option:checked"),
    ).toHaveText("Demo Stop 09");
    await expect(
      evening.getByLabel("Drop spot 1").locator("option:checked"),
    ).toHaveText("Demo Palwal Start");
    // A spot picked once in the ride isn't offered again in its other lists.
    await expect(
      evening
        .getByLabel("Drop spot 1")
        .locator("option", { hasText: "Demo Cyber City" }),
    ).toHaveCount(0);
    await expect(
      evening
        .getByLabel("Pickup spot 1")
        .locator("option", { hasText: "Demo Palwal Start" }),
    ).toHaveCount(0);
    await evening.getByRole("button", { name: /Save/ }).click();
    await expect(evening.getByText("Saved")).toBeVisible();

    // The home page now offers the evening ride too. (Not checking the morning card: the demo
    // morning ride is already live tomorrow, and after 08:00 there's no "today" left to offer.)
    await page.goto("/");
    await expect(page.getByText("Offer your evening ride")).toBeVisible();

    // The profile sums up each ride with its price.
    await page.goto("/profile");
    await expect(
      page.getByRole("listitem").filter({ hasText: /^evening/i }),
    ).toContainText("₹150 a seat");
  } finally {
    await db()
      .from("usual_rides")
      .delete()
      .eq("owner_id", OWNER.id)
      .eq("direction", "EVENING");
  }
});

// Signing up as a driver goes on from the profile to the car, then to the morning and evening
// rides.
test("a driver's sign-up goes on to the car and the rides", async ({
  page,
}) => {
  await signIn(page, OWNER.email);
  await page.goto("/profile?welcome=1");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/car\?welcome=1/);
  await page
    .getByRole("link", { name: "Next: your morning and evening rides" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Last step: your rides" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Evening: office → home" }),
  ).toBeVisible();
});

// An owner adds a stop that isn't in the list, right from a pickup list: it's picked in that
// row and is in every list straight away.
test("an owner adds a new location from a pickup list", async ({ page }) => {
  const name = `Demo Owner Corner ${Date.now()}`;
  try {
    await signIn(page, OWNER.email);
    await page.goto("/usual-ride");
    const morning = page.getByRole("region", {
      name: "Morning: home → office",
    });
    await morning.getByRole("button", { name: "+ Add a pickup spot" }).click();
    await morning
      .getByLabel("Pickup spot 2", { exact: true })
      .selectOption({ label: "+ Add a new location…" });
    const panel = morning.getByRole("group", {
      name: "New location for pickup spot 2",
    });
    await panel.getByLabel("Name").fill(name);
    await panel
      .getByLabel("Google Maps link")
      .fill("https://www.google.com/maps/search/28.2512,77.2633");
    await panel.getByRole("button", { name: "Add location" }).click();

    await expect(morning.getByRole("status")).toContainText(`Added “${name}”`);
    await expect(
      morning
        .getByLabel("Pickup spot 2", { exact: true })
        .locator("option:checked"),
    ).toHaveText(name);
    // Everyone's list has it, including the evening ride's.
    await expect(
      page
        .getByRole("region", { name: "Evening: office → home" })
        .getByLabel("Pickup spot 1", { exact: true })
        .locator("option", { hasText: name }),
    ).toHaveCount(1);
  } finally {
    await db().from("places").delete().eq("name", name);
  }
});
