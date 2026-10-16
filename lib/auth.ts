import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  name: string;
  photoUrl: string | null;
  isAdmin: boolean;
};

// The signed-in person. This is the one place pages ask "who is this?" (the Data Access Layer
// pattern from the Next.js authentication guide). It redirects instead of returning:
// - to /login when nobody is signed in;
// - to /no-invite when someone signed in with Google but has no profile, because they never
//   redeemed an invite (Q3).
// It reads cookies, so call it inside a <Suspense> boundary (Cache Components requires that).
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase.rpc("get_my_profile").maybeSingle();
  if (!profile) {
    redirect("/no-invite");
  }

  return {
    id: profile.id,
    name: profile.name,
    photoUrl: profile.photo_url,
    isAdmin: profile.is_admin,
  };
}
