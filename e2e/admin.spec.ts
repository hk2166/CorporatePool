import { expect, test } from "@playwright/test";
import { db, PASSWORD, RIDE, RIDER, SECOND, signedIn, signIn } from "./support";

// The admin pages: the one-page dashboard, today's numbers, a member in full, and the rides
// list. It only reads, so it doesn't disturb the demo ride the user flows share.
test("an admin sees who uses the app, where they go, and the rides", async ({
  page,
}) => {
  await signIn(page, SECOND.email);
  await page.getByRole("link", { name: /^Admin dashboard/ }).click();

  // The dashboard: every panel on one page, over a time range.
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Active today" }),
  ).toContainText(/[1-9]/);
  await expect(
    page
      .getByRole("region", { name: "Upcoming rides" })
      .locator(`a[href="/rides/${RIDE}"]`),
  ).toBeVisible();
  await page.getByRole("link", { name: "7d" }).click();
  await expect(page.getByText(/Last 7 days/)).toBeVisible();

  await page.getByRole("link", { name: "Admin", exact: true }).click();
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

// Someone signs in without an invite, asks to join, and an admin lets them in.
test("someone without an invite asks to join and an admin accepts", async ({
  browser,
}) => {
  const d = db();
  const email = `demo-newcomer-${Date.now()}@example.com`;
  const { data, error } = await d.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo Newcomer" },
  });
  if (error) throw error;
  const id = data.user.id;

  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/no-invite$/);

    await page
      .getByLabel(/A note for the admin/)
      .fill("Demo note: mornings from the demo stop");
    await page.getByRole("button", { name: "Ask to join" }).click();
    await expect(
      page.getByRole("heading", { name: "Request sent" }),
    ).toBeVisible();

    const admin = await signedIn(browser, SECOND.email);
    await admin.goto("/admin/requests");
    await expect(
      admin.getByText("Demo note: mornings from the demo stop"),
    ).toBeVisible();
    await admin.getByRole("button", { name: "Accept Demo Newcomer" }).click();
    await expect(
      admin.getByRole("link", { name: "Demo Newcomer" }),
    ).toBeVisible();

    // In: the new member lands on their profile to add a phone number.
    await page.getByRole("link", { name: "Check again" }).click();
    await expect(page).toHaveURL(/\/profile/);
  } finally {
    await d.from("users").delete().eq("id", id);
    await d.auth.admin.deleteUser(id);
  }
});
