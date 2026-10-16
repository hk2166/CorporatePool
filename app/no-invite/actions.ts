"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type JoinRequestState = { error?: string };

// Asks the admins to let the signed-in person in. The database takes their name, email and
// photo from their Google account; the note is theirs.
export async function requestToJoin(
  _previous: JoinRequestState,
  formData: FormData,
): Promise<JoinRequestState> {
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 300);
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_to_join", {
    p_note: note || undefined,
  });
  if (error?.hint === "MEMBER") redirect("/");
  if (error && error.hint !== "REJECTED") {
    return { error: "Couldn't send your request. Please try again." };
  }
  refresh();
  return {};
}
