import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig, type Database } from "./config";

// Supabase with the secret key. It bypasses Row-Level Security, so only server code that
// enforces its own rules may use it: invites, going live, seats, scores and scheduled jobs.
// `server-only` makes importing this from browser code a build error.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY must be set (server only). See .env.example.",
    );
  }
  const { url } = getSupabaseConfig();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
