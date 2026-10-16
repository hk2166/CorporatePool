import { expect, test } from "@playwright/test";
import { db, RIDER, signIn } from "./support";

// Riding, driving or both: the home page follows the answer, and the profile changes it.
test("a rider who starts driving too changes it on their profile", async ({
  page,
}) => {
  try {
    await signIn(page, RIDER.email);
    // Riders get Find and Profile in the menu, and no car pages.
    const menu = page.getByRole("navigation", { name: "Main" });
    await expect(menu.getByRole("link")).toHaveText(["Find", "Profile"]);
    await page.goto("/car");
    await expect(page.getByText("This is for car owners.")).toBeVisible();
    await page.goto("/");
    // Riders see riding only.
    await expect(
      page.getByRole("link", { name: /My usual commute, tomorrow/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your car" })).toHaveCount(
      0,
    );

    await page.getByRole("link", { name: "Offer your seats as well" }).click();
    await page.getByRole("button", { name: /^Both/ }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Both/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Add your car" }),
    ).toBeVisible();
    // Car owners get Offer and Car in the menu too.
    await expect(menu.getByRole("link")).toHaveText([
      "Find",
      "Offer",
      "Car",
      "Profile",
    ]);
  } finally {
    await db()
      .from("users")
      .update({ ride_preference: "RIDER" })
      .eq("id", RIDER.id);
  }
});
