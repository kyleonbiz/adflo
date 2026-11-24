import type { Metadata } from "next";
import { SalesPage } from "@/components/control/sales-page";
import { loadBillingInvoices, loadClients, loadPlans, SAMPLE_CLIENTS, SAMPLE_PLANS } from "@/lib/control/data";
import { sampleSnapshots } from "@/lib/control/sales";
import { loadSnapshots, recordRevenueSnapshot } from "@/lib/control/snapshots";
import { renderControlShell } from "@/lib/control/shell";
import { createServiceSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sales & revenue · Control center" };
export const dynamic = "force-dynamic";

export default function SalesRoute() {
  // Today in UTC, decided here so the server and the browser agree on the month.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell("/control/sales", async (ctx) => {
    if (ctx.mode !== "live") return <SalesPage clients={SAMPLE_CLIENTS} plans={SAMPLE_PLANS} snapshots={sampleSnapshots(today)} today={today} sample />;
    // Opening the page records today's figures too, so the trend starts at once instead of at the next nightly run.
    const admin = createServiceSupabase();
    if (admin) await recordRevenueSnapshot(admin, today);
    const [clients, plans, snapshots, invoices] = await Promise.all([loadClients(ctx.supabase), loadPlans(ctx.supabase), loadSnapshots(ctx.supabase), loadBillingInvoices(ctx.supabase)]);
    return <SalesPage clients={clients} plans={plans} snapshots={snapshots} today={today} sample={false} invoices={invoices} />;
  });
}
