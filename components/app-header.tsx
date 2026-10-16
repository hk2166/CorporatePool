import Link from "next/link";

// The bar at the top of every signed-in page. It doesn't read the session itself, so it can be
// part of a page's static shell. Signing out lives on the profile page, to keep this bar to one
// line on a phone.
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <Link href="/" className="font-semibold tracking-tight">
        CorporatePool
      </Link>
      <nav className="flex items-center">
        <Link
          href="/search"
          className="rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Find
        </Link>
        <Link
          href="/usual-ride"
          className="rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Ride
        </Link>
        <Link
          href="/car"
          className="rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Car
        </Link>
        <Link
          href="/profile"
          className="rounded-lg px-2 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Profile
        </Link>
      </nav>
    </header>
  );
}
