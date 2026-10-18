import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GOOGLE_SITE_VERIFICATION } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Absolute links in shared previews (WhatsApp needs a full URL for the preview image).
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "CorporatePool",
  description:
    "Free shared rides to work: drivers fill their empty seats, riders find a seat.",
  // <meta name="google-site-verification">, on every page.
  verification: { google: GOOGLE_SITE_VERIFICATION },
  // Installed on an iPhone's home screen, it opens full screen like an app (T-8.1).
  appleWebApp: {
    capable: true,
    title: "CorporatePool",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
