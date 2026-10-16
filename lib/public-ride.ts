import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import type { PublicRide, PublicStop } from "@/lib/ride-card";
import { getSupabaseConfig, type Database } from "@/lib/supabase/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A ride's public card (F-H1), exactly what get_public_ride() exposes and nothing more: the
// route, time, price, seats left and the owner's first name. Works without signing in.
//
// Cached for about a minute: WhatsApp fetches the page and its preview image when a link is
// pasted, and a visitor arriving from the group shouldn't wait on the database either. Seat
// counts are at most a minute old here; booking (Phase 5) always checks the live number.
export async function getPublicRide(id: string): Promise<PublicRide | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  if (!UUID.test(id)) return null;

  // No cookies: this runs the same for everyone, as a visitor who isn't signed in.
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .rpc("get_public_ride", { p_ride_id: id })
    .maybeSingle();
  if (!data) return null;

  return {
    ...data,
    stops: (data.stops as PublicStop[] | null) ?? [],
  };
}
