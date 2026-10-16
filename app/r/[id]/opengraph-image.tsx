import { ImageResponse } from "next/og";
import { getPublicRide } from "@/lib/public-ride";
import { routeSummary, seatsSummary, whenSummary } from "@/lib/ride-card";

// The preview card WhatsApp shows when a ride link is pasted (F-H1).
export const alt = "A shared ride on CorporatePool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ride = await getPublicRide(id);

  const route = ride ? routeSummary(ride.stops) : "Ride not found";
  const when = ride ? whenSummary(ride.depart_at) : "";
  const seats = ride ? seatsSummary(ride) : "";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0b0b0b",
        color: "#ffffff",
      }}
    >
      <div style={{ fontSize: 36, color: "#34d399", display: "flex" }}>
        CorporatePool
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            display: "flex",
          }}
        >
          {route}
        </div>
        <div style={{ fontSize: 44, color: "#d4d4d4", display: "flex" }}>
          {when}
        </div>
      </div>
      {ride && (
        <div
          style={{ display: "flex", gap: 32, fontSize: 48, fontWeight: 600 }}
        >
          <div style={{ display: "flex", color: "#34d399" }}>{seats}</div>
          <div style={{ display: "flex" }}>₹{ride.price_per_seat} a seat</div>
          <div style={{ display: "flex", color: "#a3a3a3" }}>
            with {ride.owner_first_name}
          </div>
        </div>
      )}
    </div>,
    size,
  );
}
