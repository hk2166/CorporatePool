import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// "Reliability 52": the signed-in person's score, a tap away from what makes it up (F-F4).
export async function ScoreChip({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_reliability", { p_user_id: userId })
    .maybeSingle();
  if (!data) return null;
  return (
    <Link
      href="/reliability"
      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-neutral-300 px-3 text-sm whitespace-nowrap dark:border-neutral-700"
    >
      Reliability{" "}
      <span className="font-semibold tabular-nums">
        {data.reliability_score}
      </span>
    </Link>
  );
}
