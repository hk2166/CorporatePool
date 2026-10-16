import { unblockUser } from "@/app/report/[userId]/actions";
import { createClient } from "@/lib/supabase/server";

// The people you've blocked, on your profile (F-F8). Nothing is shown when there are none.
export async function BlockedList() {
  const supabase = await createClient();
  // The access rules show only your own blocks.
  const { data: blocks } = await supabase
    .from("blocks")
    .select("blocked_id, person:users!blocks_blocked_id_fkey(name)")
    .order("created_at");
  if (!blocks?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Blocked</h2>
      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {blocks.map((b) => (
          <li
            key={b.blocked_id}
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            <span>{b.person?.name ?? "Someone"}</span>
            <form action={unblockUser}>
              <input type="hidden" name="blockedId" value={b.blocked_id} />
              <button
                type="submit"
                className="h-9 rounded-lg border border-neutral-300 px-3 text-sm font-medium dark:border-neutral-700"
              >
                Unblock
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
