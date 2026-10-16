import { expect, test } from "@playwright/test";

// Every page ends with who built the app, linking to their GitHub.
test("the foot of the page credits the maker, with their GitHub", async ({
  page,
}) => {
  await page.goto("/home");
  await expect(page.getByText("Built by Hemant")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "GitHub @hk2166" }),
  ).toHaveAttribute("href", "https://github.com/hk2166");
});
