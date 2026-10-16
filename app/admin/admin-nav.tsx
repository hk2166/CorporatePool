import Link from "next/link";

const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Overview" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/rides", label: "Rides" },
  { href: "/admin/rankings", label: "Rankings" },
  { href: "/admin/occupancy", label: "Occupancy" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/stops", label: "Stops" },
  { href: "/admin/invites", label: "Invites" },
] as const;

// The admin area's tabs (F-G1, F-G2, F-G4, F-G6).
export function AdminNav({
  current,
}: {
  current: (typeof TABS)[number]["href"];
}) {
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:flex-wrap md:overflow-visible">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
            t.href === current
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
