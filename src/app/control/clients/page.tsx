import type { Metadata } from "next";
import { ClientsPage } from "@/components/control/clients-page";
import { loadClients, loadPlans, loadUnlinkedWorkspaces, SAMPLE_CLIENTS, SAMPLE_PLANS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Clients · Control center" };
export const dynamic = "force-dynamic";

export default function ClientsRoute() {
  // Today in UTC, decided here so the server and the browser agree on which clients are new.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell("/control/clients", async (ctx) =>
    ctx.mode === "live"
      ? <ClientsPage clients={await loadClients(ctx.supabase)} plans={await loadPlans(ctx.supabase)} canEdit={canEditClients(ctx.staff.role)} isOwner={ctx.staff.role === "owner"} today={today} leftovers={canEditClients(ctx.staff.role) ? await loadUnlinkedWorkspaces(ctx.supabase) : []} />
      : <ClientsPage clients={SAMPLE_CLIENTS} plans={SAMPLE_PLANS} canEdit={false} sample today={today} />,
  );
}
