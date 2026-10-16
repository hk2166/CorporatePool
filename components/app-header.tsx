import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

// The bar at the top of every signed-in page. It doesn't read the session itself, so it can be
// part of a page's static shell.
export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <Link href="/" className="font-semibold tracking-tight">
        CorporatePool
      </Link>
      <nav className="flex items-center gap-1">
        <Link
          href="/profile"
          className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Profile
        </Link>
        <SignOutButton />
      </nav>
    </header>
  );
}
