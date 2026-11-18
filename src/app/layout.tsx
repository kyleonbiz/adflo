import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { CANONICAL_ORIGIN } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  openGraph: {
    type: "website",
    siteName: "AdFlo",
    title: "AdFlo · Administrative management platform",
    description: "Records, compliance deadlines, and equipment and asset tracking for contractors and property managers, in one place.",
  },
  twitter: { card: "summary_large_image" },
  title: {
    default: "AdFlo · Administrative management platform",
    template: "%s · AdFlo",
  },
  description:
    "AdFlo is the administrative management platform for contractors and property managers, ready for other industries: records, licenses, insurance, vendors, invoices, paperwork and projects in one place, with reminders so nothing slips.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#287cff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
