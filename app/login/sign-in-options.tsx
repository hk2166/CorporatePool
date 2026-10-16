"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  // Where to go after signing in; already checked by safeNextPath.
  next: string;
  error?: string;
  // A neutral message, like "Your account has been deleted."
  notice?: string;
  // They opened an invite link and now need to sign in to join.
  invited?: boolean;
  // Email and password sign-in for the local demo people (supabase/seed/20_demo.sql).
  // Only shown when NEXT_PUBLIC_DEV_LOGIN=true, and the live project rejects it anyway
  // because email sign-in is switched off there.
  devLogin: boolean;
};

export function SignInOptions({
  next,
  error,
  notice,
  invited,
  devLogin,
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(error ?? null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setMessage(null);
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    // On success the browser is already on its way to Google.
    if (error) {
      setBusy(false);
      setMessage("Couldn't reach Google. Please try again.");
    }
  }

  // A form action rather than onSubmit: until the page's JavaScript has loaded, React renders
  // this form so that submitting it does nothing, instead of the browser falling back to a
  // plain GET that would put the email and password in the URL.
  async function signInWithPassword(form: FormData) {
    setBusy(true);
    setMessage(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {notice}
        </p>
      )}

      {invited && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          You&apos;ve been invited. Sign in with Google to join.
        </p>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        <GoogleLogo />
        Continue with Google
      </button>

      {message && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {message}
        </p>
      )}

      {devLogin && (
        <form
          action={signInWithPassword}
          className="space-y-3 rounded-xl border border-dashed border-amber-400 p-4"
        >
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Local development: sign in as a demo person
          </p>
          <input
            name="email"
            type="email"
            required
            placeholder="seed-rider@example.com"
            autoComplete="username"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-transparent px-3 dark:border-neutral-700"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password from supabase/seed/20_demo.sql"
            autoComplete="current-password"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-transparent px-3 dark:border-neutral-700"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-lg bg-amber-500 font-medium text-white disabled:opacity-60"
          >
            Sign in
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
