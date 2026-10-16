import { createClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";

// The demo data from supabase/seed/20_demo.sql.
export const OWNER = {
  id: "5eed0000-0000-0000-0000-000000000001",
  email: "seed-owner@example.com",
};
export const RIDER = {
  id: "5eed0000-0000-0000-0000-000000000002",
  email: "seed-rider@example.com",
};
// The demo admin doubles as a second rider.
export const SECOND = {
  id: "5eed0000-0000-0000-0000-000000000003",
  email: "seed-admin@example.com",
};
export const RIDE = "5eed0000-0000-0000-0000-0000000000d1";
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "demo-password";

// The database, with the secret key: the tests use it to set the scene and to stand in for
// the clock ("it's now past 22:00"), never to do what a person would do on screen.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed",
    );
  return createClient(url, key, { auth: { persistSession: false } });
}

const hours = (n: number) =>
  new Date(Date.now() + n * 60 * 60 * 1000).toISOString();

// The demo ride as a fresh evening: leaves in a day, seats handed out in 12 hours, nobody
// booked, every demo person at 50 points.
export async function freshRide({
  seats = 3,
  departInHours = 24,
  allocationInHours = 12,
}: {
  seats?: number;
  departInHours?: number;
  allocationInHours?: number;
} = {}) {
  const d = db();
  const people = [OWNER.id, RIDER.id, SECOND.id];
  await d.from("reliability_events").delete().in("user_id", people);
  await d.from("notifications_outbox").delete().in("user_id", people);
  await d.from("blocks").delete().in("blocker_id", people);
  await d.from("bookings").delete().eq("ride_id", RIDE);
  const { error } = await d
    .from("rides")
    .update({
      status: "OPEN",
      seats_total: seats,
      seats_left: seats,
      depart_at: hours(departInHours),
      allocation_at: hours(Math.min(allocationInHours, departInHours)),
      reminded_at: null,
      hidden_at: null,
    })
    .eq("id", RIDE);
  if (error) throw error;
  await d.from("users").update({ reliability_score: 50 }).in("id", people);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

// A separate browser (its own cookies) signed in as someone.
export async function signedIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

export async function bookingStatuses(): Promise<string[]> {
  const { data } = await db()
    .from("bookings")
    .select("status")
    .eq("ride_id", RIDE)
    .order("status");
  return (data ?? []).map((b) => b.status);
}
