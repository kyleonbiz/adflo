import { headers } from "next/headers";
import { LiveDashboard } from "@/components/modules/dashboard";
import { dayInZone } from "@/lib/dashboard/logic";

/** The signed-in home. The services keep their records in this browser, so the numbers are worked out there (see `LiveDashboard`). */
export async function ModuleOverview({ base, name }: { base: "/app"; name?: string }) {
  // The visitor's own day where the host tells us their time zone (Vercel does); otherwise UTC.
  const today = dayInZone((await headers()).get("x-vercel-ip-timezone"));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{name ? `Welcome back, ${name}.` : "Welcome back."} Here is where things stand.</p>
      </div>
      <LiveDashboard base={base} serverToday={today} name={name} />
    </div>
  );
}
