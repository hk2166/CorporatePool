// Invite links (Q3: invite-only). /invite/<token> remembers the token in this cookie while the
// person signs in with Google; /auth/join then redeems it.
export const INVITE_COOKIE = "cp_invite";

// Same rule as signup_tokens.token in the database: at least 22 base64url characters.
export function looksLikeInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{22,}$/.test(token);
}

type AuthUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

// The name and photo a new member starts with, taken from their Google account. Google calls
// them full_name/name and avatar_url/picture. The database trims the name and drops anything
// that isn't an http(s) photo URL, so this only picks the best candidate.
export function profileFromAuthUser(user: AuthUser): {
  name: string | null;
  photoUrl: string | null;
} {
  const meta = user.user_metadata ?? {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === "string" && value.trim() !== "") return value;
    }
    return null;
  };
  return {
    name: pick("full_name", "name") ?? user.email?.split("@")[0] ?? null,
    photoUrl: pick("avatar_url", "picture"),
  };
}
