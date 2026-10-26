import type { Metadata } from "next";
import { LiveWorkspace } from "@/components/dms/live-workspace";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default function AppPage() {
  return renderAppShell("/app", (mode) => <LiveWorkspace mode={mode} />);
}
