import type { Metadata } from "next";
import { ClientsPage } from "@/components/control/clients-page";
import { loadClients, loadPlans, SAMPLE_CLIENTS, SAMPLE_PLANS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Clients · Control center" };
export const dynamic = "force-dynamic";

export default function ClientsRoute() {
  return renderControlShell("/control/clients", async (ctx) =>
    ctx.mode === "live"
      ? <ClientsPage clients={await loadClients(ctx.supabase)} plans={await loadPlans(ctx.supabase)} canEdit={canEditClients(ctx.staff.role)} isOwner={ctx.staff.role === "owner"} />
      : <ClientsPage clients={SAMPLE_CLIENTS} plans={SAMPLE_PLANS} canEdit={false} sample />,
  );
}
