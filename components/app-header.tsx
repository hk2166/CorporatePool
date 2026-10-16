import Link from "next/link";

// The bar at the top of every signed-in page. It doesn't read the session itself, so it can be
// part of a page's static shell. Signing out lives on the profile page, to keep this bar to one
// line on a phone. It stays at the top while the page scrolls, and its contents line up with
// the widest pages on a laptop.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-background/90 backdrop-blur dark:border-neutral-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center font-semibold tracking-tight"
        >
          CorporatePool
        </Link>
        <nav className="flex items-center">
          <Link
            href="/search"
            className="rounded-lg px-1.5 py-2 text-sm font-medium whitespace-nowrap min-[360px]:px-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Find
          </Link>
          <Link
            href="/usual-ride"
            className="rounded-lg px-1.5 py-2 text-sm font-medium whitespace-nowrap min-[360px]:px-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Ride
          </Link>
          <Link
            href="/car"
            className="rounded-lg px-1.5 py-2 text-sm font-medium whitespace-nowrap min-[360px]:px-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Car
          </Link>
          <Link
            href="/feedback"
            className="hidden rounded-lg px-1.5 py-2 text-sm font-medium whitespace-nowrap min-[360px]:px-2 text-neutral-600 hover:bg-neutral-100 sm:inline-block dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Feedback
          </Link>
          <Link
            href="/profile"
            className="rounded-lg px-1.5 py-2 text-sm font-medium whitespace-nowrap min-[360px]:px-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Profile
          </Link>
        </nav>
      </div>
    </header>
  );
}
