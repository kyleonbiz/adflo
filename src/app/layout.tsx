import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
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
