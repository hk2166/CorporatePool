import { expect, test } from "@playwright/test";

// Every page ends with who built the app.
test("the foot of the page credits the maker", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByText("Built by Hemant")).toBeVisible();
  await expect(page.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
});
