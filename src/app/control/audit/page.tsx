import type { Metadata } from "next";
import { loadAudit } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { describeAudit } from "@/lib/control/validation";

export const metadata: Metadata = { title: "Audit log · Control center" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default function AuditRoute() {
  return renderControlShell("/control/audit", async (ctx) => {
    const owner = ctx.mode === "live" && ctx.staff.role === "owner";
    const entries = owner && ctx.mode === "live" ? await loadAudit(ctx.supabase) : [];
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Every change staff make to a client, with who and when. Entries cannot be edited or removed.</p>
        </div>
        {!owner ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-panel">
            <p className="font-medium">{ctx.mode === "preview" ? "Nothing to show in the preview" : "Only the Owner can read the audit log"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{ctx.mode === "preview" ? "Connect the database to record staff actions." : "Your own actions are still recorded."}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-panel"><p className="font-medium">No staff actions yet</p><p className="mt-1 text-sm text-muted-foreground">Changes to clients will appear here.</p></div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card shadow-panel">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0"><span className="font-medium">{describeAudit(e.action, e.detail)}</span></span>
                <span className="text-xs text-muted-foreground">{e.staffEmail || "System"} · {when(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  });
}
