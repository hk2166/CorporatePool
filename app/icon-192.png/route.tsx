import { appIcon } from "@/lib/app-icon";

// The 192 px app icon for the web app manifest (T-8.1).
export function GET() {
  return appIcon(192);
}
