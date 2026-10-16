import Link from "next/link";
import { dayLabel, indiaDate, indiaTime } from "@/lib/india-time";
import { createClient } from "@/lib/supabase/server";

const STATUS: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  WAITLISTED: "Waitlisted",
};

// The rider's upcoming seats on the home page, each a tap away from its ride page. Nothing is
// shown when there are none.
export async function MySeats({ userId }: { userId: string }) {
  const supabase = await createClient();
  // Rides that left up to 3 hours ago are still "today's ride".
  const since = new Date(
    new Date().getTime() - 3 * 60 * 60 * 1000,
  ).toISOString();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, waitlist_rank, ride:rides!inner(id, depart_at)")
    .eq("rider_id", userId)
    .in("status", ["REQUESTED", "CONFIRMED", "WAITLISTED"])
    .gte("ride.depart_at", since)
    .limit(10);
  if (!bookings?.length) return null;

  const sorted = [...bookings].sort((a, b) =>
    a.ride.depart_at.localeCompare(b.ride.depart_at),
  );
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-neutral-500">Your seats</h2>
      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {sorted.map((b) => (
          <li key={b.id}>
            <Link
              href={`/rides/${b.ride.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span>
                {dayLabel(indiaDate(new Date(b.ride.depart_at)))} ·{" "}
                {indiaTime(b.ride.depart_at)}
              </span>
              <span
                className={
                  b.status === "CONFIRMED"
                    ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-sm text-neutral-500"
                }
              >
                {STATUS[b.status]}
                {b.status === "WAITLISTED" && ` #${b.waitlist_rank}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
