import { appIcon } from "@/lib/app-icon";

// The iPhone home-screen icon (T-8.1); Next.js links it as apple-touch-icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
