import { isCronRequest } from "@/lib/jobs/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Keep-warm (hld.md "Scheduled jobs"): a free Supabase project pauses after a week with no
// traffic, and a paused database runs none of its own jobs. Vercel's daily cron (vercel.json)
// calls this, with CRON_SECRET, so the database always sees at least one request a day.
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { error } = await createAdminClient()
    .from("places")
    .select("id", { head: true, count: "exact" });
  if (error) return new Response("Database unreachable", { status: 503 });
  return Response.json({ ok: true });
}
