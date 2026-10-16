import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSeatsLeft, LiveSeatsProvider } from "@/components/live-seats";

// A stand-in for Supabase Realtime: remembers the subscription so a test can push a change.
const realtime = vi.hoisted(() => ({
  filter: "",
  push: (() => {}) as (row: object) => void,
  subscribed: 0,
  removed: 0,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: (
        _type: string,
        options: { filter: string },
        callback: (change: { new: object }) => void,
      ) => {
        realtime.filter = options.filter;
        realtime.push = (row) => callback({ new: row });
        return channel;
      },
      subscribe: () => {
        realtime.subscribed += 1;
        return channel;
      },
    };
    return {
      channel: () => channel,
      removeChannel: () => {
        realtime.removed += 1;
      },
      auth: { getSession: async () => ({ data: { session: {} } }) },
    };
  },
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  realtime.subscribed = 0;
  realtime.removed = 0;
  refresh.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

// Lets the "wait for the session, then subscribe" step finish.
const settle = () => act(async () => {});

describe("LiveSeatsLeft", () => {
  it("says Full when no seats are left", () => {
    render(<LiveSeatsLeft rideId="a" seatsLeft={0} status="FULL" />);
    expect(screen.getByText("Full")).toBeDefined();
  });

  it("uses the singular for one seat and the plural for several", () => {
    render(<LiveSeatsLeft rideId="a" seatsLeft={1} status="OPEN" />);
    render(<LiveSeatsLeft rideId="b" seatsLeft={3} status="OPEN" />);
    expect(screen.getByText("1 seat left")).toBeDefined();
    expect(screen.getByText("3 seats left")).toBeDefined();
  });

  it("says Cancelled for a cancelled ride", () => {
    render(<LiveSeatsLeft rideId="a" seatsLeft={3} status="CANCELLED" />);
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  it("can show the total too", () => {
    render(<LiveSeatsLeft rideId="a" seatsLeft={2} status="OPEN" total={4} />);
    expect(screen.getByText("2 of 4 seats free")).toBeDefined();
  });
});

describe("LiveSeatsProvider", () => {
  it("moves the count when the ride changes, and only for that ride", async () => {
    render(
      <LiveSeatsProvider rideIds={["a", "b"]}>
        <LiveSeatsLeft rideId="a" seatsLeft={3} status="OPEN" />
        <LiveSeatsLeft rideId="b" seatsLeft={2} status="OPEN" />
      </LiveSeatsProvider>,
    );
    await settle();
    expect(realtime.filter).toBe("id=in.(a,b)");
    expect(realtime.subscribed).toBe(1);

    act(() => realtime.push({ id: "a", seats_left: 0, status: "FULL" }));
    expect(screen.getByText("Full")).toBeDefined();
    expect(screen.getByText("2 seats left")).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shares one subscription, and leaves it a few seconds after the last viewer", async () => {
    vi.useFakeTimers();
    const first = render(
      <LiveSeatsProvider rideIds={["c"]}>
        <LiveSeatsLeft rideId="c" seatsLeft={3} status="OPEN" />
      </LiveSeatsProvider>,
    );
    await settle();
    first.unmount();
    // Back straight away, as after a refresh: the same subscription carries on.
    const second = render(
      <LiveSeatsProvider rideIds={["c"]}>
        <LiveSeatsLeft rideId="c" seatsLeft={3} status="OPEN" />
      </LiveSeatsProvider>,
    );
    await settle();
    vi.advanceTimersByTime(10_000);
    expect([realtime.subscribed, realtime.removed]).toEqual([1, 0]);

    second.unmount();
    vi.advanceTimersByTime(4_000);
    expect(realtime.removed).toBe(0);
    vi.advanceTimersByTime(2_000);
    expect(realtime.removed).toBe(1);
  });

  it("can reload the page's data on a change", async () => {
    render(
      <LiveSeatsProvider rideIds={["d"]} refresh>
        <LiveSeatsLeft rideId="d" seatsLeft={3} status="OPEN" />
      </LiveSeatsProvider>,
    );
    await settle();
    act(() => realtime.push({ id: "d", seats_left: 2, status: "OPEN" }));
    expect(screen.getByText("2 seats left")).toBeDefined();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reloads the page's data when the page comes back into view", () => {
    render(
      <LiveSeatsProvider rideIds={["e"]}>
        <LiveSeatsLeft rideId="e" seatsLeft={3} status="OPEN" />
      </LiveSeatsProvider>,
    );
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
