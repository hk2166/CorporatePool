import { appIcon } from "@/lib/app-icon";

// The 512 px maskable app icon for Android's adaptive icons (T-8.1).
export function GET() {
  return appIcon(512, { maskable: true });
}
