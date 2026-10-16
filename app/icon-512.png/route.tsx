import { appIcon } from "@/lib/app-icon";

// The 512 px app icon for the web app manifest (T-8.1).
export function GET() {
  return appIcon(512);
}
