import { describe, expect, it } from "vitest";
import {
  inviteEndsAt,
  inviteName,
  looksLikeInviteToken,
  profileFromAuthUser,
  splitInvites,
} from "@/lib/invites";

describe("looksLikeInviteToken", () => {
  it("accepts tokens like the ones create-invite makes", () => {
    expect(looksLikeInviteToken("Zq8_x-AbCdEfGhIjKlMnOpQr")).toBe(true);
  });

  it("accepts names admins choose", () => {
    expect(looksLikeInviteToken("palwal-gurgaon")).toBe(true);
  });

  it("rejects short or oddly shaped tokens before touching the database", () => {
    expect(looksLikeInviteToken("ab")).toBe(false);
    expect(looksLikeInviteToken("-palwal")).toBe(false);
    expect(looksLikeInviteToken("has spaces in it but is long enough")).toBe(
      false,
    );
    expect(looksLikeInviteToken("../../etc/passwd-aaaaaaaaaaaa")).toBe(false);
  });
});

describe("profileFromAuthUser", () => {
  it("uses Google's full name and avatar", () => {
    expect(
      profileFromAuthUser({
        email: "asha@gmail.com",
        user_metadata: {
          full_name: "Demo Person",
          avatar_url: "https://lh3.googleusercontent.com/a/demo",
        },
      }),
    ).toEqual({
      name: "Demo Person",
      photoUrl: "https://lh3.googleusercontent.com/a/demo",
    });
  });

  it("falls back to the other Google field names", () => {
    expect(
      profileFromAuthUser({
        user_metadata: {
          name: "Demo Name",
          picture: "https://example.com/p.jpg",
        },
      }),
    ).toEqual({ name: "Demo Name", photoUrl: "https://example.com/p.jpg" });
  });

  it("falls back to the email's first part when there's no name", () => {
    expect(
      profileFromAuthUser({
        email: "demo.person@example.com",
        user_metadata: {},
      }),
    ).toEqual({ name: "demo.person", photoUrl: null });
  });
});

describe("inviteName", () => {
  it("tidies what the admin typed into a link name", () => {
    expect(inviteName("  Palwal Gurgaon ")).toBe("palwal-gurgaon");
    expect(inviteName("Office_Pool--2026")).toBe("office-pool-2026");
  });

  it("refuses names that can't be one", () => {
    expect(inviteName("ab")).toBeNull();
    expect(inviteName("palwal/../admin")).toBeNull();
    expect(inviteName("x".repeat(41))).toBeNull();
  });
});

describe("inviteEndsAt", () => {
  const now = new Date("2026-10-17T06:30:00Z"); // 12:00 in India

  it("adds the preset", () => {
    expect(inviteEndsAt("1h", "", now)?.toISOString()).toBe(
      "2026-10-17T07:30:00.000Z",
    );
    expect(inviteEndsAt("7d", "", now)?.toISOString()).toBe(
      "2026-10-24T06:30:00.000Z",
    );
  });

  it("reads a chosen end as India time", () => {
    expect(inviteEndsAt("until", "2026-10-19T21:00", now)?.toISOString()).toBe(
      "2026-10-19T15:30:00.000Z",
    );
  });

  it("refuses ends in the past, too far ahead, or unknown choices", () => {
    expect(inviteEndsAt("until", "2026-10-17T11:00", now)).toBeNull();
    expect(inviteEndsAt("until", "2027-01-30T09:00", now)).toBeNull();
    expect(inviteEndsAt("until", "tomorrow", now)).toBeNull();
    expect(inviteEndsAt("forever", "", now)).toBeNull();
  });
});

describe("splitInvites", () => {
  it("keeps links open until they end or fill up", () => {
    const now = new Date("2026-10-17T06:30:00Z");
    const links = [
      {
        token: "open",
        used_count: 3,
        max_uses: 50,
        expires_at: "2026-10-20T00:00:00Z",
      },
      {
        token: "full",
        used_count: 5,
        max_uses: 5,
        expires_at: "2026-10-20T00:00:00Z",
      },
      {
        token: "past",
        used_count: 1,
        max_uses: 50,
        expires_at: "2026-10-16T00:00:00Z",
      },
    ];
    const { open, ended } = splitInvites(links, now);
    expect(open.map((l) => l.token)).toEqual(["open"]);
    expect(ended.map((l) => l.token)).toEqual(["full", "past"]);
  });
});
