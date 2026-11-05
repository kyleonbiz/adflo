import type { Metadata } from "next";
import { SupportPage } from "@/components/control/support-page";
import { loadClients, loadDirectory, loadTickets, SAMPLE_CLIENTS, SAMPLE_TICKETS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Support · Control Center" };
export const dynamic = "force-dynamic";

export default function SupportRoute() {
  return renderControlShell("/control/support", async (ctx) => {
    if (ctx.mode === "preview") return <SupportPage tickets={SAMPLE_TICKETS} clients={SAMPLE_CLIENTS} directory={[]} canEdit={false} sample />;
    const [tickets, clients, directory] = await Promise.all([loadTickets(ctx.supabase), loadClients(ctx.supabase), loadDirectory(ctx.supabase)]);
    return <SupportPage tickets={tickets} clients={clients} directory={directory} canEdit={canEditClients(ctx.staff.role)} />;
  });
}
