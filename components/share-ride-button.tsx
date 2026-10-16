"use client";

import { useState } from "react";

type Props = {
  // The full message: the ride card line and the link (lib/ride-card.ts shareMessage).
  message: string;
  url: string;
  label?: string;
};

// Shares a ride into WhatsApp (F-H1, user flow 3). On phones this opens the system share sheet
// (WhatsApp is usually first); elsewhere it opens WhatsApp with the message ready to send.
export function ShareRideButton({
  message,
  url,
  label = "Share to WhatsApp",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Dismissed, or not allowed here: fall through to WhatsApp directly.
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: nothing else to do.
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={share}
        className="h-12 flex-1 rounded-xl bg-[#25D366] font-semibold text-white transition hover:brightness-95"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={copy}
        className="h-12 rounded-xl border border-neutral-300 px-4 text-sm font-medium dark:border-neutral-700"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
