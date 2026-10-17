import { expect, test } from "@playwright/test";
import {
  bookingStatuses,
  db,
  freshRide,
  OWNER,
  RIDE,
  RIDER,
  SECOND,
  signedIn,
  signIn,
} from "./support";

// User flows 1–5 and 9 of docs/user-flows.md, on a phone-sized screen. They share the demo
// ride, so they run in order.
test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // Leave the demo ride as the seed has it: tomorrow, seats handed out tonight.
  await freshRide();
});

test("flow 1: a commuter finds a seat", async ({ page }) => {
  await freshRide();
  await signIn(page, RIDER.email);

  // "My usual commute, tomorrow": one tap from the home page.
  await page.getByRole("link", { name: /My usual commute, tomorrow/ }).click();
  await expect(
    page.getByRole("heading", { name: "1 car tomorrow" }),
  ).toBeVisible();
  await expect(page.getByText("3 seats left")).toBeVisible();

  await page.locator(`a[href^="/rides/${RIDE}"]`).click();
  await expect(page.getByLabel("Put me in any car going my way")).toBeChecked();
  await page.getByRole("button", { name: "Ask for a seat" }).click();

  // Before 22:00 the evening before, a request only queues (Q4).
  await expect(
    page.getByRole("heading", { name: "You've asked for a seat" }),
  ).toBeVisible();
  expect(await bookingStatuses()).toEqual(["REQUESTED"]);
});

test("flow 2: an owner's one-time setup is there to use", async ({ page }) => {
  await signIn(page, OWNER.email);
  await page.goto("/car");
  await expect(page.locator('input[value="XX01DM0001"]')).toBeVisible();
  await page.goto("/usual-ride");
  // The saved morning route: its first stop is picked in the first stop list.
  await expect(
    page
      .getByRole("region", { name: "Morning: home → office" })
      .getByLabel("Pickup spot 1")
      .locator("option:checked"),
  ).toHaveText("Demo Palwal Start");
});

test("flow 4: more requests than seats, and the most reliable rider gets it", async ({
  browser,
}) => {
  // The rider asked first (flow 1); a second rider asks too. One seat, and the second rider
  // has the better record.
  const second = await signedIn(browser, SECOND.email);
  await second.goto(`/rides/${RIDE}`);
  await second.getByRole("button", { name: "Ask for a seat" }).click();
  await expect(
    second.getByRole("heading", { name: "You've asked for a seat" }),
  ).toBeVisible();

  const d = db();
  await d
    .from("rides")
    .update({ seats_total: 1, seats_left: 1 })
    .eq("id", RIDE);
  await d.from("users").update({ reliability_score: 90 }).eq("id", SECOND.id);
  // 22:00 comes: allocation runs.
  await d
    .from("rides")
    .update({ allocation_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", RIDE);
  await d.rpc("run_allocation");

  await second.reload();
  await expect(
    second.getByRole("heading", { name: "Your seat is confirmed" }),
  ).toBeVisible();
  const rider = await signedIn(browser, RIDER.email);
  await rider.goto(`/rides/${RIDE}`);
  await expect(
    rider.getByRole("heading", { name: "You're #1 in line for a seat" }),
  ).toBeVisible();
});

test("flow 5: a confirmed rider cancels and the next in line gets the seat", async ({
  browser,
}) => {
  const second = await signedIn(browser, SECOND.email);
  await second.goto(`/rides/${RIDE}`);
  await second.getByText("Cancel my seat").click();
  // After 22:00 it's a late cancel, and the screen says so before it happens.
  await expect(second.getByText(/lowers your score by 5/)).toBeVisible();
  await second.getByRole("button", { name: "Yes, give up my seat" }).click();
  await expect(
    second.getByRole("button", { name: "Ask for a seat" }),
  ).toBeVisible();

  // The waitlisted rider is in, without anyone doing anything.
  const rider = await signedIn(browser, RIDER.email);
  await rider.goto(`/rides/${RIDE}`);
  await expect(
    rider.getByRole("heading", { name: "Your seat is confirmed" }),
  ).toBeVisible();
  await expect(rider.getByRole("link", { name: "WhatsApp" })).toBeVisible();

  const { data } = await db()
    .from("reliability_events")
    .select("kind, points")
    .eq("user_id", SECOND.id);
  expect(data).toEqual([{ kind: "LATE_CANCEL", points: -5 }]);
});

test("flow 3: the owner's morning: start, tick who came, finish", async ({
  browser,
}) => {
  // The ride leaves in half an hour.
  await db()
    .from("rides")
    .update({ depart_at: new Date(Date.now() + 30 * 60_000).toISOString() })
    .eq("id", RIDE);

  const owner = await signedIn(browser, OWNER.email);
  await owner.goto(`/rides/${RIDE}`);
  await expect(owner.getByText("Demo Rider")).toBeVisible();
  await owner.getByRole("button", { name: "Start ride" }).click();
  await owner.getByRole("button", { name: "Came" }).click();
  await expect(owner.getByText("Came", { exact: true })).toBeVisible();
  await owner.getByRole("button", { name: "Finish ride" }).click();
  await expect(owner.getByText(/Ride finished/)).toBeVisible();

  const rider = await signedIn(browser, RIDER.email);
  await rider.goto(`/rides/${RIDE}`);
  await expect(
    rider.getByRole("heading", { name: "You rode with Demo" }),
  ).toBeVisible();
});

test("flow 9: two people, one seat, the same second", async ({ browser }) => {
  // One seat left, handed out first come.
  await freshRide({ seats: 1, departInHours: 5, allocationInHours: -1 });
  const [a, b] = await Promise.all([
    signedIn(browser, RIDER.email),
    signedIn(browser, SECOND.email),
  ]);
  await Promise.all([a.goto(`/rides/${RIDE}`), b.goto(`/rides/${RIDE}`)]);
  await Promise.all([
    a.getByRole("button", { name: "Ask for a seat" }).click(),
    b.getByRole("button", { name: "Ask for a seat" }).click(),
  ]);

  // Exactly one seat taken, the other rider waitlisted, and the count never below zero.
  await expect.poll(bookingStatuses).toEqual(["CONFIRMED", "WAITLISTED"]);
  const { data: ride } = await db()
    .from("rides")
    .select("seats_left, status")
    .eq("id", RIDE)
    .single();
  expect(ride).toEqual({ seats_left: 0, status: "FULL" });

  const headings = await Promise.all(
    [a, b].map((p) =>
      p
        .getByRole("heading", {
          name: /Your seat is confirmed|in line for a seat/,
        })
        .textContent(),
    ),
  );
  expect(headings.sort()).toEqual([
    "You're #1 in line for a seat",
    "Your seat is confirmed",
  ]);
});
