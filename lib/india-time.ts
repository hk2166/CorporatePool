// Dates and times in India (IST, UTC+5:30), whatever time zone the server runs in. Rides are
// planned in local days ("tomorrow at 08:00"), so the app works in IST calendar dates.

const TIME_ZONE = "Asia/Kolkata";

// The calendar date in India, as YYYY-MM-DD.
export function indiaDate(at: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(at);
}

// YYYY-MM-DD plus or minus whole days.
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

// "Fri 17 Oct" for a YYYY-MM-DD date.
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// "08:00" in India for a moment in time.
export function indiaTime(at: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(new Date(at));
}
