// Facts the public pages share (front page, privacy policy, terms).

// Where people write to about their data or the service. It's also the user support email on
// the Google sign-in consent screen.
export const SUPPORT_EMAIL = "h3mant525@gmail.com";

// Proves to Google (Search Console, URL-prefix property https://corporatepool.vercel.app/)
// that this site is ours, for the sign-in brand verification. Not a secret: it's in every
// page's HTML. Removing it would undo the verification.
export const GOOGLE_SITE_VERIFICATION =
  "3CJBDBY3Oon8Zg59jDeM_NU99JNnzWG5982fFW8U9g4";

// When the privacy policy and terms last changed. Update it with them.
export const LEGAL_UPDATED = "18 October 2026";

// Who built the app, credited at the foot of every page.
export const MAKER = {
  name: "Hemant",
  github: "hk2166",
  githubUrl: "https://github.com/hk2166",
};
