#!/usr/bin/env node
// Prints a new invite link to share in the WhatsApp group. The admin screen (/admin/invites,
// T-7.3) does the same; this stays for the very first invite, or from a terminal.
//
//   npm run admin:invite                         one person, valid 7 days
//   npm run admin:invite -- --uses 50 --days 14  a link the whole group can use
import { randomBytes } from "node:crypto";
import { adminClient, fail } from "./lib/admin-client.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    fail(`--${name} must be a whole number of at least 1`);
  }
  return value;
}

const uses = option("uses", 1);
const days = option("days", 7);
if (uses > 1000) fail("--uses can be at most 1000");

const supabase = adminClient();

// Invites record which admin created them.
const { data: admin, error: adminError } = await supabase
  .from("users")
  .select("id, name")
  .eq("is_admin", true)
  .order("created_at")
  .limit(1)
  .maybeSingle();
if (adminError) fail(adminError.message);
if (!admin) {
  fail("there's no admin yet. Run: npm run admin:make -- you@gmail.com");
}

// 18 random bytes = 24 base64url characters, about 144 bits: impossible to guess.
const token = randomBytes(18).toString("base64url");
const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const { error } = await supabase.from("signup_tokens").insert({
  token,
  created_by: admin.id,
  max_uses: uses,
  expires_at: expiresAt.toISOString(),
});
if (error) fail(error.message);

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
console.log(`✓ Invite created by ${admin.name}`);
console.log(`  ${site}/invite/${token}`);
console.log(
  `  ${uses === 1 ? "One person" : `Up to ${uses} people`}, until ${expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
);
