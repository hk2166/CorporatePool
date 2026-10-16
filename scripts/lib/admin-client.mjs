// A Supabase client with the secret key, for the admin scripts in scripts/. They run with
// `node --env-file=.env.local`, so they act on whichever project .env.local points at (the
// local database while developing, the live one when it points there).
import { createClient } from "@supabase/supabase-js";

export function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.",
    );
  }
  console.log(`• Project: ${url}`);
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
