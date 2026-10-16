import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, looksLikeInviteToken } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";

// An invite link: https://<site>/invite/<token>. If the invite can still be used, it's kept in
// a cookie for a day and the person goes on to /auth/join, which asks them to sign in first if
// needed. The use is only spent when they actually join, in redeem_invite().
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/invite/[token]">,
) {
  const { token } = await params;
  const { origin } = request.nextUrl;
  const invalid = NextResponse.redirect(
    new URL("/login?error=invite-invalid", origin),
  );

  if (!looksLikeInviteToken(token)) return invalid;

  // Reading invites needs the secret key: they're hidden from everyone but admins (T-1.3).
  const { data: invite } = await createAdminClient()
    .from("signup_tokens")
    .select("used_count, max_uses, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (
    !invite ||
    invite.used_count >= invite.max_uses ||
    new Date(invite.expires_at) <= new Date()
  ) {
    return invalid;
  }

  const response = NextResponse.redirect(new URL("/auth/join", origin));
  response.cookies.set(INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
