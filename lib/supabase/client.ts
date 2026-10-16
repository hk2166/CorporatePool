import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig, type Database } from "./config";

// Supabase acting as the signed-in person, for Client Components. Row-Level Security applies:
// the browser can only read what the access rules allow, and can't write anything with
// business rules (docs/hld.md, T-1.3).
export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey, {
    // Realtime's keep-alive runs in a Web Worker, which browsers don't slow down in a
    // background tab. Without it the server drops the connection after a while, and the live
    // seat counts (T-4.3) stop moving.
    realtime: { worker: true },
  });
}
