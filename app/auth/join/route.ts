import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, profileFromAuthUser } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Turns a signed-in Google account into a member by redeeming the invite remembered in the
// cookie. Reached from an invite link (/invite/<token>), and from getCurrentUser() whenever a
// signed-in person has no profile yet.
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  const supabase = await createClient();
  // getUser() asks Supabase Auth directly instead of trusting the cookie: this decides who
  // becomes a member, so it's worth the extra request.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return go("/login?invited=1&next=%2Fauth%2Fjoin");
  }

  const token = request.cookies.get(INVITE_COOKIE)?.value;
  if (!token) {
    // No invite in hand: members go home, everyone else to the "invite needed" page.
    const { data: profile } = await supabase
      .rpc("get_my_profile")
      .maybeSingle();
    return go(profile ? "/" : "/no-invite");
  }

  const { name, photoUrl } = profileFromAuthUser(user);
  const { data: joined } = await createAdminClient().rpc("redeem_invite", {
    p_token: token,
    p_user_id: user.id,
    p_name: name ?? "",
    p_photo_url: photoUrl ?? "",
  });

  const response = go(joined ? "/" : "/no-invite");
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
