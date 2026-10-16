import { expect, test } from "@playwright/test";
import { db, OWNER, RIDER, SECOND, signedIn } from "./support";

// Feedback: a member sends an idea, another upvotes it, and an admin marks it planned with a
// reply everyone sees.
test("members send feedback and upvote it, and an admin answers", async ({
  browser,
}) => {
  const title = `Demo idea ${Date.now()}`;
  try {
    const rider = await signedIn(browser, RIDER.email);
    await rider.getByRole("link", { name: /Ideas or problems\?/ }).click();
    await rider.getByLabel("In a few words").fill(title);
    await rider.getByRole("button", { name: "Send feedback" }).click();
    // It arrives with the sender's own vote.
    const mine = rider.getByRole("button", { name: `Upvote: ${title}` });
    await expect(mine).toHaveAttribute("aria-pressed", "true");
    await expect(mine).toHaveText("▲1");

    const owner = await signedIn(browser, OWNER.email);
    await owner.goto("/feedback");
    const vote = owner.getByRole("button", { name: `Upvote: ${title}` });
    await expect(vote).toHaveAttribute("aria-pressed", "false");
    await vote.click();
    await expect(vote).toHaveText("▲2");
    await owner.reload();
    await expect(vote).toHaveAttribute("aria-pressed", "true");
    await expect(vote).toHaveText("▲2");

    const admin = await signedIn(browser, SECOND.email);
    await admin.goto("/admin/feedback");
    await admin.getByLabel(`Status: ${title}`).selectOption("PLANNED");
    await admin.getByLabel(`Reply: ${title}`).fill("Demo reply: on the list");
    await admin
      .getByRole("listitem")
      .filter({ hasText: title })
      .getByRole("button", { name: "Save" })
      .click();
    await expect(admin.getByText("Saved.")).toBeVisible();

    await rider.reload();
    const item = rider.getByRole("listitem").filter({ hasText: title });
    await expect(item.getByText("Planned", { exact: true })).toBeVisible();
    await expect(item.getByText("Demo reply: on the list")).toBeVisible();
  } finally {
    await db().from("feedback").delete().like("title", "Demo idea %");
  }
});
