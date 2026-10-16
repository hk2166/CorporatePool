import { isCronRequest } from "@/lib/jobs/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Keep-warm (hld.md "Scheduled jobs"): a free Supabase project pauses after a week without
// database activity, and a paused database runs none of its own jobs. Vercel's daily cron
// (vercel.json) calls this, with CRON_SECRET, and it writes (keep_alive: one timestamp,
// updated in place), so the project sees a real write from outside at least once a day.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data: beatAt, error } = await createAdminClient().rpc("keep_alive");
  if (error) return new Response("Database unreachable", { status: 503 });
  return Response.json({ ok: true, beatAt });
}
