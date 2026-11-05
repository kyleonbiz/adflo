import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketDetail } from "@/components/control/ticket-detail";
import { loadDirectory, loadTicket } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";
import { isUuid } from "@/lib/control/validation";

export const metadata: Metadata = { title: "Ticket · Control Center" };
export const dynamic = "force-dynamic";

export default async function TicketRoute({ params }: PageProps<"/control/support/[id]">) {
  const { id } = await params;
  return renderControlShell(`/control/support/${id}`, async (ctx) => {
    if (ctx.mode !== "live" || !isUuid(id)) notFound();
    const found = await loadTicket(ctx.supabase, id);
    if (!found) notFound();
    return <TicketDetail ticket={found.ticket} notes={found.notes} directory={await loadDirectory(ctx.supabase)} canEdit={canEditClients(ctx.staff.role)} />;
  });
}
