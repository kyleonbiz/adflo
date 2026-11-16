import type { Metadata } from "next";
import { OnboardingPage } from "@/components/control/onboarding-page";
import { loadClients, SAMPLE_CLIENTS } from "@/lib/control/data";
import { onboardingRows } from "@/lib/control/onboarding";
import { renderControlShell } from "@/lib/control/shell";
import { canEditClients } from "@/lib/control/types";

export const metadata: Metadata = { title: "Onboarding · Control center" };
export const dynamic = "force-dynamic";

export default function OnboardingRoute() {
  // Today in UTC, decided here so the server and the browser agree on what is stalled.
  const today = new Date().toISOString().slice(0, 10);
  return renderControlShell("/control/onboarding", async (ctx) =>
    ctx.mode === "live"
      ? <OnboardingPage rows={onboardingRows(await loadClients(ctx.supabase), today)} canAdd={canEditClients(ctx.staff.role)} />
      : <OnboardingPage rows={onboardingRows(SAMPLE_CLIENTS, today)} canAdd={false} sample />,
  );
}
