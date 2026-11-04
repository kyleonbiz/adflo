import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/control/client-detail";
import { ClientExtras } from "@/components/control/client-extras";
import { loadClients, loadPlans, loadTickets, loadTimeline } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Client · Control Center" };
export const dynamic = "force-dynamic";

export default async function ClientRoute({ params }: PageProps<"/control/clients/[id]">) {
  const { id } = await params;
  return renderControlShell(`/control/clients/${id}`, async (ctx) => {
    if (ctx.mode !== "live") notFound(); // the preview has only sample rows, which have no detail page
    const client = (await loadClients(ctx.supabase)).find((c) => c.id === id);
    if (!client) notFound();
    const canEdit = canEditClients(ctx.staff.role);
    const [plans, tickets, timeline] = await Promise.all([loadPlans(ctx.supabase), loadTickets(ctx.supabase, id), loadTimeline(ctx.supabase, id)]);
    return (
      <ClientDetail client={client} plans={plans} canEdit={canEdit} isOwner={ctx.staff.role === "owner"}>
        <ClientExtras clientId={id} ownerEmail={client.ownerEmail} tickets={tickets} timeline={timeline} canEdit={canEdit} />
      </ClientDetail>
    );
  });
}
