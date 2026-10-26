import { headers } from "next/headers";
import { Dashboard } from "@/components/modules/dashboard";
import { loadDashboardSources } from "@/lib/dashboard/data";
import { buildDashboard, dayInZone } from "@/lib/dashboard/logic";

/** The signed-in home. Its numbers are computed here, on the server, so none of the services' data or logic ships to the browser. */
export async function ModuleOverview({ base, name }: { base: "/app"; name?: string }) {
  // The visitor's own day where the host tells us their time zone (Vercel does); otherwise UTC.
  const today = dayInZone((await headers()).get("x-vercel-ip-timezone"));
  const data = buildDashboard(await loadDashboardSources(today), today, base);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Dashboard base={base} data={data} serverToday={today} name={name} />
    </div>
  );
}
