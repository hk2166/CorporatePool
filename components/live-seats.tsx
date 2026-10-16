"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

type LiveRide = { seatsLeft: number; status: string };
type RideRow = { id: string; seats_left: number; status: string };
type Listener = (row: RideRow) => void;

const LiveRides = createContext<ReadonlyMap<string, LiveRide>>(new Map());

// One Realtime channel per set of rides on screen, shared by everything showing them. It's left
// a few seconds after the last viewer goes, because React often mounts the same list again
// straight away (a refresh, or every mount in development), and a channel left while it's still
// joining can take its replacement's subscription down with it.
const LEAVE_AFTER_MS = 5000;
const channels = new Map<
  string,
  {
    listeners: Set<Listener>;
    leave: () => void;
    timer?: ReturnType<typeof setTimeout>;
  }
>();

function watchRides(ids: string, listener: Listener): () => void {
  let entry = channels.get(ids);
  if (!entry) {
    const supabase = createClient();
    const listeners = new Set<Listener>();
    const channel = supabase
      .channel(`rides-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=in.(${ids})`,
        },
        (change) => {
          for (const notify of listeners) notify(change.new as RideRow);
        },
      );
    // Join only once the signed-in session has loaded: a channel that joins before that joins
    // as a visitor, who isn't allowed to see rides, and silently never gets a change.
    void supabase.auth.getSession().then(() => channel.subscribe());
    entry = { listeners, leave: () => supabase.removeChannel(channel) };
    channels.set(ids, entry);
  }
  const current = entry;
  clearTimeout(current.timer);
  current.listeners.add(listener);

  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    current.timer = setTimeout(() => {
      channels.delete(ids);
      current.leave();
    }, LEAVE_AFTER_MS);
  };
}

// Keeps the seat counts of the rides on screen live (F-C3, lld.md §2); each <LiveSeatsLeft>
// inside picks its own ride. With `refresh`, the whole page also reloads its data on a change
// (the owner's ride page, where a seat changing means the rider list changed too).
export function LiveSeatsProvider({
  rideIds,
  refresh = false,
  children,
}: {
  rideIds: string[];
  refresh?: boolean;
  children: ReactNode;
}) {
  const [rides, setRides] = useState<ReadonlyMap<string, LiveRide>>(new Map());
  const router = useRouter();
  // Realtime takes up to 100 ids in one filter; the search page shows far fewer.
  const ids = rideIds.slice(0, 100).join(",");

  useEffect(() => {
    if (!ids) return;
    return watchRides(ids, (row) => {
      setRides((current) =>
        new Map(current).set(row.id, {
          seatsLeft: row.seats_left,
          status: row.status,
        }),
      );
      if (refresh) router.refresh();
    });
  }, [ids, refresh, router]);

  // A phone puts a page to sleep when you switch apps, and changes sent meanwhile are missed.
  // Coming back reloads the page's data, so the counts are right again straight away.
  useEffect(() => {
    if (!ids) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ids, router]);

  return <LiveRides.Provider value={rides}>{children}</LiveRides.Provider>;
}

// "3 seats left", "Full" or "Cancelled", updated the moment it changes. With `total`, it reads
// "3 of 4 seats free" instead.
export function LiveSeatsLeft({
  rideId,
  seatsLeft,
  status,
  total,
}: {
  rideId: string;
  seatsLeft: number;
  status: string;
  total?: number;
}) {
  const live = useContext(LiveRides).get(rideId);
  const seats = live?.seatsLeft ?? seatsLeft;
  const current = live?.status ?? status;

  let text: string;
  if (current === "CANCELLED") text = "Cancelled";
  else if (seats <= 0) text = "Full";
  else if (total) text = `${seats} of ${total} seats free`;
  else text = `${seats} ${seats === 1 ? "seat" : "seats"} left`;

  return (
    <span
      aria-live="polite"
      className={`font-medium whitespace-nowrap ${
        current === "CANCELLED" || seats <= 0
          ? "text-red-600 dark:text-red-400"
          : ""
      }`}
    >
      {text}
    </span>
  );
}
