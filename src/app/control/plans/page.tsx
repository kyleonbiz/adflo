import type { Metadata } from "next";
import { PlansPage } from "@/components/control/plans-page";
import { loadPlans, SAMPLE_PLANS } from "@/lib/control/data";
import { renderControlShell } from "@/lib/control/shell";

export const metadata: Metadata = { title: "Plans & pricing · Control center" };
export const dynamic = "force-dynamic";

export default function PlansRoute() {
  return renderControlShell("/control/plans", async (ctx) =>
    ctx.mode === "live"
      ? <PlansPage plans={await loadPlans(ctx.supabase)} canEdit={ctx.staff.role === "owner"} />
      : <PlansPage plans={SAMPLE_PLANS} canEdit={false} sample />,
  );
}
