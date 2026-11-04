import type { Metadata } from "next";
import { TeamPage } from "@/components/control/team-page";
import { loadStaff } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Team · Control Center" };
export const dynamic = "force-dynamic";

export default function TeamRoute() {
  return renderControlShell("/control/team", async (ctx) => {
    if (ctx.mode === "preview") {
      return <TeamPage sample staff={[{ userId: "s1", role: "owner", displayName: "Sample Owner", email: "owner@example.com", active: true }, { userId: "s2", role: "support", displayName: "Sample Support", email: "support@example.com", active: true }]} />;
    }
    if (ctx.staff.role !== "owner") {
      return (
        <div className="space-y-5">
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <div className="rounded-2xl border bg-card p-8 text-center shadow-panel"><p className="font-medium">Only the Owner manages the team</p><p className="mt-1 text-sm text-muted-foreground">Ask an Owner to change roles or add people.</p></div>
        </div>
      );
    }
    return <TeamPage staff={await loadStaff(ctx.supabase)} selfId={ctx.staff.userId} />;
  });
}
