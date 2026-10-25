import type { Metadata } from "next";
import { ModuleOverview } from "@/components/modules/module-overview";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return renderAppShell("overview", "/app/overview", () => <ModuleOverview base="/app" />);
}
