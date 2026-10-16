import { describe, expect, it } from "vitest";
import { looksLikeInviteToken, profileFromAuthUser } from "@/lib/invites";

describe("looksLikeInviteToken", () => {
  it("accepts tokens like the ones create-invite makes", () => {
    expect(looksLikeInviteToken("Zq8_x-AbCdEfGhIjKlMnOpQr")).toBe(true);
  });

  it("rejects short or oddly shaped tokens before touching the database", () => {
    expect(looksLikeInviteToken("short")).toBe(false);
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
