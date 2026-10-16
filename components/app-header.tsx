import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isCarOwner } from "@/lib/ride-preference";

// The bar at the top of every signed-in page. Everyone gets Find and Profile; car owners also
// get Offer (their morning and evening rides) and Car. The logo and the two common links are
// part of the static shell; who's signed in (and so the owner links) streams in. Signing out
// lives on the profile page, to keep this bar to one line on a phone. It stays at the top
// while the page scrolls, and lines up with the widest pages on a laptop.
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
        <Suspense fallback={<Menu owner={false} />}>
          <MemberMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function MemberMenu() {
  const user = await getCurrentUser();
  return <Menu owner={isCarOwner(user.ridePreference)} />;
}

const linkClass =
  "rounded-lg px-1.5 py-2 text-sm font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-100 min-[360px]:px-2 dark:text-neutral-400 dark:hover:bg-neutral-800";

function Menu({ owner }: { owner: boolean }) {
  return (
    <nav aria-label="Main" className="flex items-center">
      <Link href="/search" className={linkClass}>
        Find
      </Link>
      {owner && (
        <>
          <Link href="/usual-ride" className={linkClass}>
            Offer
          </Link>
          <Link href="/car" className={linkClass}>
            Car
          </Link>
        </>
      )}
      <Link href="/profile" className={linkClass}>
        Profile
      </Link>
    </nav>
  );
}
