import type { Metadata } from "next";
import { SetupPage } from "@/components/setup/setup-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Back Office Setup" };
export const dynamic = "force-dynamic";

export default function SetupRoute() {
  return renderAppShell("/app/setup", () => (
    <SetupPage base="/app" preview="Your choices are saved in this browser only and never leave it." />
  ));
}
