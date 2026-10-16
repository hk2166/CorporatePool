import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseConfig, type Database } from "./config";

// Supabase acting as the signed-in person, for Server Components, Server Actions and Route
// Handlers. Row-Level Security applies, exactly as in the browser. Create a new client for
// every request; never share one.
export async function createClient() {
  // Supabase checks token expiry against the current time. Under Cache Components, reading
  // the clock is only allowed at request time, so this marks everything using the client as
  // request-time rather than prerendered (nextjs.org/docs/messages/blocking-prerender-current-time).
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the session on every
          // request instead, so this is safe to ignore.
        }
      },
    },
  });
}
