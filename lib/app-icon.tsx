import { ImageResponse } from "next/og";

// The app's icon, drawn at build time so there are no image files to keep in sync: a route
// from one stop to another on emerald. "Maskable" keeps the drawing inside the middle 80%, the
// safe zone Android crops icons to.
export function appIcon(size: number, { maskable = false } = {}) {
  // Drawn on a 100 × 100 grid, shrunk towards the middle for the maskable version.
  const s = maskable ? 0.72 : 1;
  const at = (v: number) => 50 + (v - 50) * s;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#059669",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <path
          d={`M ${at(28)} ${at(72)} C ${at(28)} ${at(46)}, ${at(72)} ${at(54)}, ${at(72)} ${at(28)}`}
          stroke="white"
          strokeWidth={7 * s}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={at(28)} cy={at(72)} r={10 * s} fill="white" />
        <circle
          cx={at(72)}
          cy={at(28)}
          r={10 * s}
          fill="#fde68a"
          stroke="white"
          strokeWidth={5 * s}
        />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
