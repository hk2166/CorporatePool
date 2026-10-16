// Cleaning and checking what people type into their profile. The database enforces the same
// rules (supabase/migrations/…_people_and_places.sql); these give friendly messages first and
// accept the ways people actually write things.

// Indian mobile numbers, however they're typed: "98765 43210", "098765-43210",
// "+91 98765 43210", "919876543210". Returns +91XXXXXXXXXX, or null if it isn't one.
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0"))
    digits = digits.slice(1);
  // Indian mobile numbers are 10 digits and start with 6, 7, 8 or 9.
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

// A UPI ID like name@okaxis. Same pattern as users.upi_vpa.
export function isUpiId(value: string): boolean {
  return /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$/.test(value);
}

// Names are trimmed, inner runs of spaces collapsed, and 1–80 characters long.
export function cleanName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 80 ? name : null;
}
