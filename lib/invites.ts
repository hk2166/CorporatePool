// Invite links (Q3: invite-only). /invite/<token> remembers the token in this cookie while the
// person signs in with Google; /auth/join then redeems it.
export const INVITE_COOKIE = "cp_invite";

// Same rule as signup_tokens.token in the database: a random token (at least 22 base64url
// characters) or a name an admin chose (4 to 40 lowercase letters, digits and hyphens).
const RANDOM_TOKEN = /^[A-Za-z0-9_-]{22,}$/;
const LINK_NAME = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/;

export function looksLikeInviteToken(token: string): boolean {
  return RANDOM_TOKEN.test(token) || LINK_NAME.test(token);
}

// "No limit" on how many people a link lets in, as stored (signup_tokens.max_uses).
export const NO_LIMIT = 10000;

// A link name as an admin typed it, tidied: "Palwal Gurgaon" → "palwal-gurgaon". Null when
// it can't be one (too short or long, or other characters).
export function inviteName(text: string): string | null {
  const name = text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return LINK_NAME.test(name) ? name : null;
}

// How long a link stays open: a preset, or until a time the admin picks.
export const DURATIONS = [
  { value: "1h", label: "1 hour", hours: 1 },
  { value: "1d", label: "1 day", hours: 24 },
  { value: "3d", label: "3 days", hours: 72 },
  { value: "7d", label: "1 week", hours: 168 },
  { value: "14d", label: "2 weeks", hours: 336 },
  { value: "30d", label: "30 days", hours: 720 },
  { value: "until", label: "Until a date and time…", hours: 0 },
] as const;

const MAX_DAYS = 60;

// When a new link ends: `now` plus the preset, or the chosen "YYYY-MM-DDTHH:MM" taken as India
// time. Null if that's not in the future or more than 60 days away.
export function inviteEndsAt(
  duration: string,
  until: string,
  now: Date = new Date(),
): Date | null {
  const preset = DURATIONS.find((d) => d.value === duration);
  if (!preset) return null;
  const end =
    preset.value === "until"
      ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(until)
        ? new Date(`${until}:00+05:30`)
        : null
      : new Date(now.getTime() + preset.hours * 60 * 60 * 1000);
  if (!end || Number.isNaN(end.getTime())) return null;
  if (end <= now) return null;
  if (end.getTime() - now.getTime() > MAX_DAYS * 24 * 60 * 60 * 1000) {
    return null;
  }
  return end;
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

// Links still open (newest first) and ended ones: past their end, or every place used.
export function splitInvites<
  T extends { used_count: number; max_uses: number; expires_at: string },
>(invites: readonly T[], now: Date = new Date()): { open: T[]; ended: T[] } {
  const isOpen = (i: T) =>
    new Date(i.expires_at) > now && i.used_count < i.max_uses;
  return {
    open: invites.filter(isOpen),
    ended: invites.filter((i) => !isOpen(i)),
  };
}
