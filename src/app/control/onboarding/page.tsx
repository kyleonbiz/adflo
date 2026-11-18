import type { Metadata } from "next";
import { OnboardingPage } from "@/components/control/onboarding-page";
import { loadAutoStatus } from "@/lib/control/auto-due";
import { loadClients, SAMPLE_CLIENTS } from "@/lib/control/data";
import { onboardingRows } from "@/lib/control/onboarding";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Onboarding · Control center" };
export const dynamic = "force-dynamic";

export default function OnboardingRoute() {
  // Today in UTC, decided here so the server and the browser agree on what is stalled.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell("/control/onboarding", async (ctx) => {
    if (ctx.mode !== "live") return <OnboardingPage rows={onboardingRows(SAMPLE_CLIENTS, today)} canAdd={false} sample />;
    const clients = await loadClients(ctx.supabase);
    const auto = await loadAutoStatus(ctx.supabase, clients);
    return <OnboardingPage rows={onboardingRows(clients, today)} canAdd={canEditClients(ctx.staff.role)} canRemind={canEditClients(ctx.staff.role)} auto={auto} />;
  });
}
