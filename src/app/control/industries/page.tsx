import type { Metadata } from "next";
import { IndustriesPage } from "@/components/control/industries-page";
import { renderControlShell } from "@/lib/control/shell";
import { loadLiveIndustries } from "@/lib/setup/live-server";
import { FALLBACK_LIVE } from "@/lib/setup/types";

export const metadata: Metadata = { title: "Industries · Control center" };
export const dynamic = "force-dynamic";

export default function IndustriesRoute() {
  return renderControlShell("/control/industries", async (ctx) =>
    ctx.mode === "live"
      ? <IndustriesPage live={[...(await loadLiveIndustries(ctx.supabase))]} canEdit={ctx.staff.role === "owner"} />
      : <IndustriesPage live={[...FALLBACK_LIVE]} canEdit={false} sample />,
  );
}
