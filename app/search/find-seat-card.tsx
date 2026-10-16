import Link from "next/link";
import { addDays, indiaDate } from "@/lib/india-time";
import { searchHref } from "@/lib/search-query";
import { createClient } from "@/lib/supabase/server";

// The rider's half of the home page: one tap to "my usual commute, tomorrow" (F-C2), or a
// search for anything else.
export async function FindSeatCard() {
  const supabase = await createClient();
  const [{ data: me }, { data: places }] = await Promise.all([
    supabase.rpc("get_my_profile").maybeSingle(),
    supabase.rpc("list_places"),
  ]);
  const name = new Map((places ?? []).map((p) => [p.id, p.name]));
  const home = me?.home_place_id ? name.get(me.home_place_id) : undefined;
  const work = me?.work_place_id ? name.get(me.work_place_id) : undefined;
  const today = indiaDate();

  if (!me?.home_place_id || !me.work_place_id || !home || !work) {
    return (
      <section className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Need a seat?</h2>
        <Link
          href="/search"
          className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700"
        >
          Find a seat
        </Link>
        <p className="text-sm text-neutral-500">
          Save your usual stops on your{" "}
          <Link href="/profile" className="underline">
            profile
          </Link>{" "}
          to search your commute in one tap.
        </p>
      </section>
    );
  }

  const anyTime = { after: null, before: null, seats: 1 };
  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Need a seat?</h2>
      <Link
        href={searchHref({
          ...anyTime,
          from: me.home_place_id,
          to: me.work_place_id,
          date: addDays(today, 1),
        })}
        className="block rounded-xl bg-emerald-600 px-4 py-3 text-white transition hover:bg-emerald-700"
      >
        <span className="block font-semibold">My usual commute, tomorrow</span>
        <span className="block text-sm text-emerald-50">
          {home} → {work}
        </span>
      </Link>
      <div className="flex gap-4 text-sm">
        <Link
          href={searchHref({
            ...anyTime,
            from: me.work_place_id,
            to: me.home_place_id,
            date: today,
          })}
          className="underline"
        >
          Going home today
        </Link>
        <Link href="/search" className="underline">
          Another route
        </Link>
      </div>
    </section>
  );
}
