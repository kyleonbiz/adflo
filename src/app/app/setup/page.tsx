import type { Metadata } from "next";
import { SettingsPage, parseTab } from "@/components/settings/settings-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SetupRoute({ searchParams }: PageProps<"/app/setup">) {
  const { tab } = await searchParams;
  return renderAppShell("/app/setup", (mode) => (
    <SettingsPage
      tab={parseTab(Array.isArray(tab) ? tab[0] : tab)}
      mode={mode}
      base="/app"
      preview="Your choices are saved in this browser only and never leave it."
    />
  ));
}
