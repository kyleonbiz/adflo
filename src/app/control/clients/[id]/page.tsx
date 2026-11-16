import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/control/client-detail";
import { ClientExtras } from "@/components/control/client-extras";
import { WorkspaceCard } from "@/components/control/workspace-card";
import { SendAgreement } from "@/components/control/agreements-page";
import { loadClients, loadPlans, loadSent, loadTemplates, loadTickets, loadTimeline, loadUnlinkedWorkspaces } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Client · Control center" };
export const dynamic = "force-dynamic";

export default async function ClientRoute({ params }: PageProps<"/control/clients/[id]">) {
  const { id } = await params;
  return renderControlShell(`/control/clients/${id}`, async (ctx) => {
    if (ctx.mode !== "live") notFound(); // the preview has only sample rows, which have no detail page
    const client = (await loadClients(ctx.supabase)).find((c) => c.id === id);
    if (!client) notFound();
    const canEdit = canEditClients(ctx.staff.role);
    const [plans, tickets, timeline, templates, sent, unlinked] = await Promise.all([loadPlans(ctx.supabase), loadTickets(ctx.supabase, id), loadTimeline(ctx.supabase, id), loadTemplates(ctx.supabase), loadSent(ctx.supabase, id), client.workspaceId || !canEdit ? Promise.resolve([]) : loadUnlinkedWorkspaces(ctx.supabase)]);
    return (
      <ClientDetail client={client} plans={plans} canEdit={canEdit} isOwner={ctx.staff.role === "owner"}>
        <WorkspaceCard client={client} unlinked={unlinked} canEdit={canEdit} />
        <SendAgreement clientId={id} templates={templates} sent={sent} canEdit={canEdit} />
        <ClientExtras clientId={id} ownerEmail={client.ownerEmail} tickets={tickets} timeline={timeline} canEdit={canEdit} />
      </ClientDetail>
    );
  });
}
