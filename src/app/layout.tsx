import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: {
    default: "AdFlo · Your back office in one place",
    template: "%s · AdFlo",
  },
  description:
    "AdFlo turns the paperwork, invoices, renewals and projects you used to hand off into simple tools your team runs itself.",
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
