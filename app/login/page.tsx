import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/safe-next-path";
import { SignInOptions } from "./sign-in-options";

export const metadata: Metadata = { title: "Sign in · CorporatePool" };

// Messages for ?error=… codes that /auth/callback sends people back with.
const ERRORS: Record<string, string> = {
  "sign-in-failed": "Sign-in didn't finish. Please try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">CorporatePool</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Free shared rides for the daily commute, Palwal to Gurgaon.
        </p>
      </header>
      {/* The query string is only known per request, so it streams in. */}
      <Suspense
        fallback={
          <div className="h-12 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
        }
      >
        <Options searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Options({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : null,
  );
  const error =
    typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <SignInOptions
      next={next}
      error={error}
      devLogin={process.env.NEXT_PUBLIC_DEV_LOGIN === "true"}
    />
  );
}
