import type { Metadata } from "next";
import { Building2, CheckCircle2, PauseCircle, Sparkles, Armchair } from "lucide-react";
import { SummaryTile } from "@/components/modules/summary-tile";
import { loadClients, SAMPLE_CLIENTS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Control Center" };
export const dynamic = "force-dynamic";

export default function ControlHome() {
  return renderControlShell("/control", async (ctx) => {
    const clients = ctx.mode === "live" ? await loadClients(ctx.supabase) : SAMPLE_CLIENTS;
    const live = clients.filter((c) => c.status !== "cancelled");
    const n = (s: string) => clients.filter((c) => c.status === s).length;
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control Center</h1>
          <p className="text-sm text-muted-foreground">{ctx.mode === "live" ? `Welcome, ${ctx.staff.name}.` : "Preview with sample clients."} Here is where AdFlo stands.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryTile icon={Building2} label="Clients" value={clients.length} tone="text-primary" href="/control/clients" />
          <SummaryTile icon={CheckCircle2} label="Active" value={n("active")} tone="text-emerald-600" />
          <SummaryTile icon={Sparkles} label="On trial" value={n("trial")} tone="text-sky-600" />
          <SummaryTile icon={PauseCircle} label="Suspended" value={n("suspended")} tone="text-amber-600" />
          <SummaryTile icon={Armchair} label="Seats sold" value={live.reduce((a, c) => a + c.seatsLimit, 0)} tone="text-primary" />
        </div>
      </div>
    );
  });
}
