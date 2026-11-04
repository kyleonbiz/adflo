import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/control/client-detail";
import { loadClients, loadPlans } from "@/lib/control/data";
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
    return <ClientDetail client={client} plans={await loadPlans(ctx.supabase)} canEdit={canEditClients(ctx.staff.role)} isOwner={ctx.staff.role === "owner"} />;
  });
}
