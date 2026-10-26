import type { Metadata } from "next";
import { ModuleOverview } from "@/components/modules/module-overview";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return renderAppShell("/app/overview", (_mode, user) => <ModuleOverview base="/app" name={user?.name} />);
}
