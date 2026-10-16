"use client";

import { useEffect, useState } from "react";

// Chrome's install event (not in TypeScript's DOM types yet).
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "cp-install-dismissed";

type Mode = "hidden" | "button" | "ios";

// "Install the app" (F-H2, T-8.1). Android and desktop Chrome offer a real install button; an
// iPhone needs the Share → Add to Home Screen steps, and that's also what makes notifications
// work there. Hidden once installed, or after "Not now".
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Browsers want a service worker before they offer to install; it's the same one that
    // shows notifications. Registering again is harmless.
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Storage blocked: just show it.
    }
    if (installed || dismissed) return;

    const iPhone =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the device once on mount
    if (iPhone) setMode("ios");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setMode("button");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Fine: it just shows again next time.
    }
    setMode("hidden");
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setMode("hidden");
  }

  if (mode === "hidden") return null;
  return (
    <section className="space-y-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="font-medium">Install CorporatePool</p>
      {mode === "ios" ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Tap the Share button, then <strong>Add to Home Screen</strong>. It
          opens like an app, and that&apos;s what lets it send you notifications
          on an iPhone.
        </p>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          One tap from your home screen, with notifications when your seat is
          confirmed.
        </p>
      )}
      <div className="flex gap-2">
        {mode === "button" && (
          <button
            type="button"
            onClick={install}
            className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="h-10 rounded-lg border border-neutral-300 px-4 text-sm font-medium dark:border-neutral-700"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
