import type { Metadata } from "next";
import { ActivityPage } from "@/components/audit/activity-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default function ActivityRoute() {
  return renderAppShell("/app/activity", () => (
    <ActivityPage preview="The log is kept in this browser for now. It is not shared with other people or devices yet." />
  ));
}
