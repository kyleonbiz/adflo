import type { Metadata } from "next";
import { AgreementsPage } from "@/components/control/agreements-page";
import { loadSent, loadTemplates, SAMPLE_TEMPLATES } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Agreements · Control center" };
export const dynamic = "force-dynamic";

export default function AgreementsRoute() {
  return renderControlShell("/control/agreements", async (ctx) => {
    if (ctx.mode === "preview") {
      return <AgreementsPage sample canPublish={false} sent={[]} templates={SAMPLE_TEMPLATES} />;
    }
    const [templates, sent] = await Promise.all([loadTemplates(ctx.supabase), loadSent(ctx.supabase)]);
    return <AgreementsPage templates={templates} sent={sent} canPublish={ctx.staff.role === "owner"} />;
  });
}
