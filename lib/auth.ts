import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  name: string;
  photoUrl: string | null;
  isAdmin: boolean;
  // A phone number is needed before booking or offering a ride (F-A2).
  hasPhone: boolean;
};

// The signed-in person. This is the one place pages ask "who is this?" (the Data Access Layer
// pattern from the Next.js authentication guide). It redirects instead of returning:
// - to /login when nobody is signed in;
// - to /auth/join when someone signed in with Google but has no profile yet. It redeems the
//   invite they opened (Q3), or sends them on to /no-invite if they have none.
// It reads cookies, so call it inside a <Suspense> boundary (Cache Components requires that).
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: profile } = await supabase.rpc("get_my_profile").maybeSingle();
  if (!profile) {
    redirect("/auth/join");
  }

  return {
    id: profile.id,
    name: profile.name,
    photoUrl: profile.photo_url,
    isAdmin: profile.is_admin,
    hasPhone: profile.phone !== null,
  };
}

// The signed-in person, who must be an admin. Anyone else gets "not found": the admin pages
// don't advertise themselves. The database checks again in every admin function.
export async function getCurrentAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user.isAdmin) notFound();
  return user;
}
