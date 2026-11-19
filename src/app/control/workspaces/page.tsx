import type { Metadata } from "next";
import { WorkspacesPage } from "@/components/control/workspaces-page";
import { loadUnlinkedWorkspaces } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Workspaces · Control center" };
export const dynamic = "force-dynamic";

export default function WorkspacesRoute() {
  return renderControlShell("/control/workspaces", async (ctx) =>
    ctx.mode === "live"
      ? <WorkspacesPage workspaces={ctx.staff.role === "billing" ? [] : await loadUnlinkedWorkspaces(ctx.supabase)} canDelete={ctx.staff.role === "owner"} />
      : <WorkspacesPage workspaces={[]} canDelete={false} sample />,
  );
}
