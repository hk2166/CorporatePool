"use client";

import { useState } from "react";
import { whatsappShareUrl } from "@/lib/whatsapp-summary";

// The day's rides as a WhatsApp message: pick the day, check it, then share it to the group
// or copy it.
export function WhatsAppSummary({
  options,
}: {
  options: { key: string; label: string; text: string; count: number }[];
}) {
  const [key, setKey] = useState(options[0]?.key);
  const [copied, setCopied] = useState(false);
  const chosen = options.find((o) => o.key === key) ?? options[0];
  if (!chosen) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(chosen.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is still there to select by hand.
    }
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Day" className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setKey(o.key)}
            aria-pressed={o.key === chosen.key}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm ${
              o.key === chosen.key
                ? "border-neutral-900 font-medium dark:border-white"
                : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            {o.label} ({o.count})
          </button>
        ))}
      </div>
      <textarea
        readOnly
        value={chosen.text}
        rows={Math.min(14, chosen.text.split("\n").length + 1)}
        aria-label="Message for the WhatsApp group"
        className="block w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="flex gap-2">
        <a
          href={whatsappShareUrl(chosen.text)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#25D366] font-semibold text-white"
        >
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="h-11 rounded-xl border border-neutral-300 px-4 font-medium dark:border-neutral-700"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
