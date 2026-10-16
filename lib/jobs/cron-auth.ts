import "server-only";
import { timingSafeEqual } from "node:crypto";

// Routes under /api/jobs/ are called by the database (pg_cron through pg_net), never by
// people. They must carry "Authorization: Bearer <CRON_SECRET>"; the same value is kept in
// Supabase Vault as cron_secret (docs/setup.md).
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
