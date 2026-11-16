import type { Metadata } from "next";
import { BillingPage } from "@/components/control/billing-page";
import { loadClients, loadPlans, SAMPLE_CLIENTS, SAMPLE_PLANS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Billing · Control center" };
export const dynamic = "force-dynamic";

export default async function BillingRoute({ searchParams }: PageProps<"/control/billing">) {
  const { client } = await searchParams;
  const newForClient = Array.isArray(client) ? client[0] : client;
  // Today in UTC, decided here so the server and the browser agree on what is overdue.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell("/control/billing", async (ctx) =>
    ctx.mode === "live"
      ? <BillingPage clients={await loadClients(ctx.supabase)} plans={await loadPlans(ctx.supabase)} today={today} sample={false} newForClient={newForClient} />
      : <BillingPage clients={SAMPLE_CLIENTS} plans={SAMPLE_PLANS} today={today} sample newForClient={newForClient} />,
  );
}
