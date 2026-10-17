import Link from "next/link";
import type { ReactNode } from "react";

// The frame for public pages anyone can open without signing in: the front page, the privacy
// policy and the terms. Header with the app name and Log in; footer with the three links.
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-4 lg:max-w-6xl lg:px-8">
        <Link href="/home" className="flex items-center gap-2 font-semibold">
          {/* The app icon, drawn by app/icon-192.png/route.tsx. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
          />
          CorporatePool
        </Link>
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Log in
        </Link>
      </header>

      {children}

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-neutral-500 lg:max-w-6xl lg:px-8">
          <span>CorporatePool · Free shared rides to work</span>
          <nav className="flex gap-1">
            <Link
              href="/home"
              className="inline-flex min-h-10 items-center px-2 hover:underline"
            >
              Home
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-10 items-center px-2 hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-10 items-center px-2 hover:underline"
            >
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// A titled section of a policy page.
export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-neutral-700 dark:text-neutral-300 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}
