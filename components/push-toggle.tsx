"use client";

import { useEffect, useState } from "react";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/push/actions";

type State =
  | "loading"
  | "unsupported" // no service workers or Push API (iPhone before Add to Home Screen)
  | "blocked" // the person said no; only browser settings can undo it
  | "off"
  | "on"
  | "busy";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// Base64url → bytes, as PushManager.subscribe wants the server key.
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function supported(): boolean {
  return (
    Boolean(VAPID_PUBLIC_KEY) &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Turn notifications on or off for this browser (F-E1): seat confirmed, waitlisted, promoted,
// ride cancelled, car full. The `compact` form is a one-line nudge for the home page, shown
// only while they're off.
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!supported()) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    }
    check().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return setState(permission === "denied" ? "blocked" : "off");
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      const { ok } = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!ok) {
        await subscription.unsubscribe();
        return setState("off");
      }
      setState("on");
    } catch {
      setState("unsupported");
    }
  }

  async function turnOff() {
    setState("busy");
    const registration =
      await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
  }

  if (compact) {
    if (state !== "off" && state !== "busy") return null;
    return (
      <button
        type="button"
        onClick={turnOn}
        disabled={state === "busy"}
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-left text-sm disabled:opacity-60 dark:border-neutral-700"
      >
        <span className="font-medium">Turn on notifications</span>
        <span className="block text-neutral-500">
          Know the moment your seat is confirmed, or your car is full.
        </span>
      </button>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Notifications</h2>
      {state === "unsupported" && (
        <p className="text-sm text-neutral-500">
          This browser can&apos;t show notifications. On an iPhone, add the app
          to your home screen first (Share, then Add to Home Screen).
        </p>
      )}
      {state === "blocked" && (
        <p className="text-sm text-neutral-500">
          Notifications are blocked for this site. Allow them in your browser
          settings, then come back here.
        </p>
      )}
      {(state === "off" || state === "on" || state === "busy") && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {state === "on"
              ? "On for this browser."
              : "Seat confirmed, waitlist, cancellations, car full."}
          </p>
          <button
            type="button"
            onClick={state === "on" ? turnOff : turnOn}
            disabled={state === "busy"}
            className="h-10 shrink-0 rounded-lg border border-neutral-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
          >
            {state === "on" ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}
    </section>
  );
}
