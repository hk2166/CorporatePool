import type { MetadataRoute } from "next";

// What the phone needs to install CorporatePool like an app (F-H2, T-8.1). Installing is also
// what makes notifications work on an iPhone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CorporatePool",
    short_name: "CorporatePool",
    description:
      "Free shared rides to work: drivers fill their empty seats, riders find a seat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#059669",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
