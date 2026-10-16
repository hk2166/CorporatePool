// Where to send someone after they sign in. Only paths on this site are allowed, so a link
// like /login?next=https://evil.example can't bounce people to another site (an "open
// redirect"). Anything else falls back to the home page.
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  // "//host" and "/\host" are treated as other sites by browsers.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
