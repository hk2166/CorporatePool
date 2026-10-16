import { expect, test } from "@playwright/test";
import { db, PASSWORD, SECOND, signedIn } from "./support";

// An admin makes a named link, open for an hour to anyone; a newcomer opens it, signs in and
// is a member straight away.
test("an admin's named invite link lets newcomers join", async ({
  browser,
}) => {
  const name = `e2e-${Date.now()}`;
  const d = db();
  const { data, error } = await d.auth.admin.createUser({
    email: `demo-invitee-${Date.now()}@example.com`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo Invitee" },
  });
  if (error) throw error;
  try {
    const admin = await signedIn(browser, SECOND.email);
    await admin.goto("/admin/invites");
    await admin.getByLabel("Link name").fill(name);
    await admin.getByLabel("Open for").selectOption("1h");
    await expect(
      admin.getByLabel("Anyone with the link, no limit"),
    ).toBeChecked();
    await admin.getByRole("button", { name: "Create link" }).click();
    await expect(
      admin.getByText(/Anyone with the link can join until/),
    ).toBeVisible();
    await expect(
      admin.getByRole("listitem").filter({ hasText: `/invite/${name}` }),
    ).toContainText("0 joined");

    const page = await (await browser.newContext()).newPage();
    await page.goto(`/invite/${name}`);
    await expect(page).toHaveURL(/\/login/);
    await page.locator('input[name="email"]').fill(data.user.email!);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome, Demo!" }),
    ).toBeVisible();

    await admin.reload();
    await expect(
      admin.getByRole("listitem").filter({ hasText: `/invite/${name}` }),
    ).toContainText("1 joined");
  } finally {
    await d.from("users").delete().eq("id", data.user.id);
    await d.auth.admin.deleteUser(data.user.id);
    await d.from("signup_tokens").delete().eq("token", name);
  }
});
