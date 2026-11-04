import type { Metadata } from "next";
import { AgreementsPage } from "@/components/control/agreements-page";
import { loadSent, loadTemplates } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Agreements · Control Center" };
export const dynamic = "force-dynamic";

export default function AgreementsRoute() {
  return renderControlShell("/control/agreements", async (ctx) => {
    if (ctx.mode === "preview") {
      return <AgreementsPage sample canPublish={false} sent={[]} templates={[{ id: "sample-a1", title: "Terms of Service", version: 2, body: "Sample text. The real agreement appears here once the Owner publishes it.", createdAt: "2026-10-01T00:00:00Z" }]} />;
    }
    const [templates, sent] = await Promise.all([loadTemplates(ctx.supabase), loadSent(ctx.supabase)]);
    return <AgreementsPage templates={templates} sent={sent} canPublish={ctx.staff.role === "owner"} />;
  });
}
