import type { Metadata } from "next";
import { ClientsPage } from "@/components/control/clients-page";
import { loadClients, SAMPLE_CLIENTS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Clients · Control Center" };
export const dynamic = "force-dynamic";

export default function ClientsRoute() {
  return renderControlShell("/control/clients", async (ctx) =>
    ctx.mode === "live"
      ? <ClientsPage clients={await loadClients(ctx.supabase)} canEdit={canEditClients(ctx.staff.role)} />
      : <ClientsPage clients={SAMPLE_CLIENTS} canEdit={false} sample />,
  );
}
