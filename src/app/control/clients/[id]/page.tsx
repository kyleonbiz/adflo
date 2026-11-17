import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientBilling } from "@/components/control/client-billing";
import { ClientDetail } from "@/components/control/client-detail";
import { ClientExtras } from "@/components/control/client-extras";
import { SendAgreement } from "@/components/control/agreements-page";
import { WorkspaceCard } from "@/components/control/workspace-card";
import { loadClients, loadPlans, loadSent, loadTemplates, loadTickets, loadTimeline, loadUnlinkedWorkspaces, SAMPLE_CLIENTS, SAMPLE_PLANS, SAMPLE_TEMPLATES, SAMPLE_TICKETS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Client · Control center" };
export const dynamic = "force-dynamic";

const isOpen = (status: string) => status === "open" || status === "pending";

/** One client's profile: everything about them in one place. */
export default async function ClientRoute({ params }: PageProps<"/control/clients/[id]">) {
  const { id } = await params;
  // Today in UTC, decided here so the server and the browser agree on what is overdue.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell(`/control/clients/${id}`, async (ctx) => {
    if (ctx.mode !== "live") {
      // The preview shows the sample clients with sample tickets and agreements, read-only.
      const client = SAMPLE_CLIENTS.find((c) => c.id === id);
      if (!client) notFound();
      const tickets = SAMPLE_TICKETS.filter((t) => t.clientId === id);
      return (
        <ClientDetail client={client} plans={SAMPLE_PLANS} canEdit={false} isOwner={false} today={today} sample openTickets={tickets.filter((t) => isOpen(t.status)).length}>
          <div id="account" className="scroll-mt-4"><WorkspaceCard client={client} unlinked={[]} canEdit={false} /></div>
          <ClientBilling client={client} today={today} sample />
          <div id="agreements" className="scroll-mt-4"><SendAgreement clientId={id} templates={SAMPLE_TEMPLATES} sent={[]} canEdit={false} /></div>
          <ClientExtras clientId={id} ownerEmail={client.ownerEmail} tickets={tickets} timeline={[]} canEdit={false} />
        </ClientDetail>
      );
    }
    const client = (await loadClients(ctx.supabase)).find((c) => c.id === id);
    if (!client) notFound();
    const canEdit = canEditClients(ctx.staff.role);
    const [plans, tickets, timeline, templates, sent, unlinked] = await Promise.all([loadPlans(ctx.supabase), loadTickets(ctx.supabase, id), loadTimeline(ctx.supabase, id), loadTemplates(ctx.supabase), loadSent(ctx.supabase, id), client.workspaceId || !canEdit ? Promise.resolve([]) : loadUnlinkedWorkspaces(ctx.supabase)]);
    return (
      <ClientDetail client={client} plans={plans} canEdit={canEdit} isOwner={ctx.staff.role === "owner"} today={today} sample={false} openTickets={tickets.filter((t) => isOpen(t.status)).length}>
        <div id="account" className="scroll-mt-4"><WorkspaceCard client={client} unlinked={unlinked} canEdit={canEdit} /></div>
        <ClientBilling client={client} today={today} sample={false} />
        <div id="agreements" className="scroll-mt-4"><SendAgreement clientId={id} templates={templates} sent={sent} canEdit={canEdit} ownerEmail={client.ownerEmail} /></div>
        <ClientExtras clientId={id} ownerEmail={client.ownerEmail} tickets={tickets} timeline={timeline} canEdit={canEdit} />
      </ClientDetail>
    );
  });
}
