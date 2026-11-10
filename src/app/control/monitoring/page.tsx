import type { Metadata } from "next";
import { MonitoringPage, type ClientProblem } from "@/components/control/monitoring-page";
import { loadClientProblems, loadClients, loadErrors } from "@/lib/control/data";
import { runHealthChecks } from "@/lib/control/health";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Monitoring · Control center" };
export const dynamic = "force-dynamic";

export default function MonitoringRoute() {
  return renderControlShell("/control/monitoring", async (ctx) => {
    if (ctx.mode === "preview") {
      return <MonitoringPage sample canEdit={false}
        checks={[{ name: "Database", level: "ok", detail: "Answered in 42 ms." }, { name: "Error logging", level: "warn", detail: "SUPABASE_SERVICE_ROLE_KEY is not set, so server errors are not recorded." }]}
        errors={[{ id: 1, at: "2026-11-03T16:20:00Z", source: "POST /api/dms/uploads", kind: "TypeError", status: 500, clientId: null, clientName: "Sample: Acme Roofing", resolvedAt: null }]}
        problems={[{ client: { id: "sample-1", name: "Sample: Acme Roofing" }, failedDocs: 2, errors: 1 }]} />;
    }
    const [checks, errors, clients, counts] = await Promise.all([runHealthChecks(ctx.supabase), loadErrors(ctx.supabase), loadClients(ctx.supabase), loadClientProblems(ctx.supabase)]);
    const problems: ClientProblem[] = clients
      .map((c) => ({ client: { id: c.id, name: c.name }, failedDocs: counts.failedDocs.get(c.id) ?? 0, errors: counts.errors.get(c.id) ?? 0 }))
      .filter((p) => p.failedDocs > 0 || p.errors > 0);
    return <MonitoringPage checks={checks} errors={errors} problems={problems} canEdit={canEditClients(ctx.staff.role)} />;
  });
}
