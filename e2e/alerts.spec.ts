import { expect, test } from "@playwright/test";
import { db, RIDER, signIn } from "./support";

// Ride alerts: a rider picks how to hear about cars on their route.
test("a rider chooses an evening summary of cars on their route", async ({
  page,
}) => {
  try {
    await signIn(page, RIDER.email);
    await page.goto("/profile#alerts");
    await expect(
      page.getByRole("heading", { name: "Ride alerts" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Right away/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Once a day, at 8 pm/ }).click();
    await expect(page.locator("#alerts").getByText("Saved.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /^Once a day, at 8 pm/ }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    await db()
      .from("users")
      .update({ ride_alerts: "INSTANT" })
      .eq("id", RIDER.id);
  }
});
