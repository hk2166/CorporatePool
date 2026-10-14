#!/usr/bin/env node
// Copies the Google sign-in client ID and secret into .env.local (task.md H-2).
//
// Input: the JSON file Google lets you download right after creating the OAuth client.
//   node scripts/google-oauth-env.mjs ~/Downloads/client_secret_XXXX.json
//
// It never prints the secret. Other lines in .env.local are left as they are; if the file
// doesn't exist yet, it starts from .env.example.

import {
  chmodSync,
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(ROOT, ".env.local");
const EXAMPLE_FILE = resolve(ROOT, ".env.example");
const LOCAL_CALLBACK = "http://127.0.0.1:54321/auth/v1/callback";
const LIVE_CALLBACK =
  /^https:\/\/[a-z0-9]{20}\.supabase\.co\/auth\/v1\/callback$/;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  fail("usage: node scripts/google-oauth-env.mjs <client_secret_….json>");
}
if (files.length > 1) {
  fail(
    `${files.length} files matched. Pass just the one you downloaded last, or delete the old ones.`,
  );
}

let client;
try {
  client = JSON.parse(readFileSync(files[0], "utf8"));
} catch (error) {
  fail(`can't read ${files[0]}: ${error.message}`);
}

if (client.installed) {
  fail(
    'this is a Desktop client. Create a client of type "Web application" instead.',
  );
}
const web = client.web;
if (!web?.client_id || !web?.client_secret) {
  fail(
    "no client ID and secret in this file. Use the JSON from the client's Download JSON button.",
  );
}
if (!web.client_id.endsWith(".apps.googleusercontent.com")) {
  fail("the client ID doesn't look like a Google OAuth client ID.");
}

const warnings = [];
const redirects = web.redirect_uris ?? [];
if (!redirects.includes(LOCAL_CALLBACK)) {
  warnings.push(
    `Redirect URI ${LOCAL_CALLBACK} is missing, so local sign-in will fail ` +
      "with redirect_uri_mismatch. Add it to the client in the console.",
  );
}
if (!redirects.some((uri) => LIVE_CALLBACK.test(uri))) {
  warnings.push(
    "No https://<ref>.supabase.co/auth/v1/callback redirect URI yet. " +
      "Add it after H-1, or sign-in on the live site will fail.",
  );
}

if (!existsSync(ENV_FILE)) {
  if (!existsSync(EXAMPLE_FILE)) {
    fail(".env.local doesn't exist and there's no .env.example to start from.");
  }
  copyFileSync(EXAMPLE_FILE, ENV_FILE);
}

let env = readFileSync(ENV_FILE, "utf8");

function setVariable(name, value) {
  const line = `${name}=${value}`;
  const existing = new RegExp(`^${name}=.*$`, "m");
  if (existing.test(env)) {
    // A replacer function, so a "$" in the value can't be read as a pattern.
    env = env.replace(existing, () => line);
  } else {
    env += `${env === "" || env.endsWith("\n") ? "" : "\n"}${line}\n`;
  }
}

setVariable("SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID", web.client_id);
setVariable("SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET", web.client_secret);
writeFileSync(ENV_FILE, env);
chmodSync(ENV_FILE, 0o600);

console.log("✓ Wrote to .env.local (readable only by you):");
console.log(`  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID = ${web.client_id}`);
console.log("  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET    = (hidden)");
for (const warning of warnings) {
  console.log(`⚠ ${warning}`);
}
console.log(
  `\nThe downloaded file holds the secret too. Once the live Supabase has it, delete it:\n  rm "${files[0]}"`,
);
