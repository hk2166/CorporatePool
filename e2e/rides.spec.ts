import { expect, test } from "@playwright/test";
import { db, OWNER, signIn } from "./support";

// An owner's evening ride home: it starts as the morning route in reverse, and once saved the
// home page offers it next to the morning one.
test("an owner sets up the evening ride home", async ({ page }) => {
  try {
    await signIn(page, OWNER.email);
    await page.goto("/usual-ride#evening");
    const evening = page.getByRole("region", {
      name: "Evening: office → home",
    });
    await expect(
      evening.getByLabel("Stop 1").locator("option:checked"),
    ).toHaveText("Demo Cyber City");
    await expect(
      evening
        .getByLabel(/Stop \d/)
        .last()
        .locator("option:checked"),
    ).toHaveText("Demo Palwal Start");
    await evening.getByRole("button", { name: /Save/ }).click();
    await expect(evening.getByText("Saved")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText("Offer your evening ride")).toBeVisible();
    await expect(page.getByText("Offer your morning ride")).toBeVisible();

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
