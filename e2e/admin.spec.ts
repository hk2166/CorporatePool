import { expect, test } from "@playwright/test";
import { RIDE, RIDER, SECOND, signIn } from "./support";

// The admin dashboard: today's numbers, a member in full, and the rides list. It only reads,
// so it doesn't disturb the demo ride the user flows share.
test("an admin sees who uses the app, where they go, and the rides", async ({
  page,
}) => {
  await signIn(page, SECOND.email);
  await page.getByRole("link", { name: /^Admin:/ }).click();

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  // Signing in just now counts as being in the app today.
  await expect(
    page.getByRole("link", { name: /Active today\s*[1-9]/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daily users" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Members", exact: true }).click();
  await page.getByLabel("Search members").fill(RIDER.email);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(
    page.getByRole("heading", { name: "Members (1)" }),
  ).toBeVisible();
  await page.getByRole("link", { name: new RegExp(RIDER.email) }).click();
  await expect(page.getByRole("link", { name: RIDER.email })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Seats asked for" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Rides", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Coming up/ })).toBeVisible();
  await expect(page.locator(`a[href="/rides/${RIDE}"]`)).toBeVisible();
});
