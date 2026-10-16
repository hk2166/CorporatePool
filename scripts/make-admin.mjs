#!/usr/bin/env node
// Makes someone an admin. This is how the very first person gets in: invites need an admin to
// create them, so the first admin can't join through one.
//
//   1. Sign in to the app with Google once. You'll land on "You need an invite".
//   2. npm run admin:make -- you@gmail.com
//   3. Reload the app.
//
// Also works for an existing member. It only ever sets is_admin to true.
import { adminClient, fail } from "./lib/admin-client.mjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  fail("usage: npm run admin:make -- someone@gmail.com");
}

const supabase = adminClient();

// Find their sign-in account.
let authUser;
for (let page = 1; !authUser; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page,
    perPage: 200,
  });
  if (error) fail(`couldn't list accounts: ${error.message}`);
  authUser = data.users.find((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 200) break;
}
if (!authUser) {
  fail(
    `no account for ${email}. Sign in to the app with Google once, then run this again.`,
  );
}

const { data: existing, error: readError } = await supabase
  .from("users")
  .select("id, name, is_admin")
  .eq("id", authUser.id)
  .maybeSingle();
if (readError) fail(readError.message);

if (existing) {
  if (existing.is_admin) {
    console.log(`✓ ${existing.name} (${email}) is already an admin.`);
    process.exit(0);
  }
  const { error } = await supabase
    .from("users")
    .update({ is_admin: true })
    .eq("id", authUser.id);
  if (error) fail(error.message);
  console.log(`✓ ${existing.name} (${email}) is now an admin.`);
} else {
  const meta = authUser.user_metadata ?? {};
  const name = String(meta.full_name ?? meta.name ?? email.split("@")[0])
    .trim()
    .slice(0, 80);
  const photo = meta.avatar_url ?? meta.picture;
  const { error } = await supabase.from("users").insert({
    id: authUser.id,
    name,
    photo_url: /^https?:\/\//.test(photo ?? "") ? photo : null,
    is_admin: true,
  });
  if (error) fail(error.message);
  console.log(`✓ ${name} (${email}) has joined as the first admin.`);
}
