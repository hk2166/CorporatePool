import type { Database } from "@/lib/database.types";

export type { Database };

// Read as plain property accesses so Next.js can inline them into browser code.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// The Supabase project the app talks to. Called when a client is created, never at import
// time, so `next build` works without any environment variables.
export function getSupabaseConfig(): { url: string; publishableKey: string } {
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. " +
        "Copy .env.example to .env.local and see docs/setup.md.",
    );
  }
  return { url, publishableKey };
}
