"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const EVERY = [
  { seconds: 0, label: "Off" },
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
] as const;

// Grafana's refresh picker: refresh now, or every so often. Refreshing re-reads the numbers
// on the server; the page stays where it is.
export function RefreshPicker() {
  const router = useRouter();
  const [every, setEvery] = useState(60);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!every) return;
    const id = setInterval(
      () => startTransition(() => router.refresh()),
      every * 1000,
    );
    return () => clearInterval(id);
  }, [every, router]);

  return (
    <div className="flex h-9 items-stretch overflow-hidden sm:h-8 rounded-[3px] border border-[#2c3036] bg-[#181b1f] text-[13px] text-[#ccccdc]">
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        aria-label="Refresh now"
        className="flex items-center gap-1.5 px-2.5 hover:bg-[#22252b]"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
        >
          <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3" />
        </svg>
        <span className="hidden sm:inline">Refresh</span>
      </button>
      <select
        value={every}
        onChange={(e) => setEvery(Number(e.target.value))}
        aria-label="Auto-refresh"
        className="border-l border-[#2c3036] bg-[#181b1f] px-2 hover:bg-[#22252b]"
      >
        {EVERY.map((e) => (
          <option key={e.seconds} value={e.seconds}>
            {e.label}
          </option>
        ))}
      </select>
    </div>
  );
}
