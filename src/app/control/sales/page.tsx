import type { Metadata } from "next";
import { SalesPage } from "@/components/control/sales-page";
import { loadClients, loadPlans, SAMPLE_CLIENTS, SAMPLE_PLANS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Sales & revenue · Control center" };
export const dynamic = "force-dynamic";

export default function SalesRoute() {
  // Today in UTC, decided here so the server and the browser agree on the month.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell("/control/sales", async (ctx) =>
    ctx.mode === "live"
      ? <SalesPage clients={await loadClients(ctx.supabase)} plans={await loadPlans(ctx.supabase)} today={today} sample={false} />
      : <SalesPage clients={SAMPLE_CLIENTS} plans={SAMPLE_PLANS} today={today} sample />,
  );
}
