import { loadDashboardSources } from "@/lib/dashboard/data";
import { emptySources, type ReportSources } from "./logic";

/**
 * The one place Reporting gets its records, the same way the dashboard does. The services keep their
 * records in the browser until they are backed by the database, so there is nothing to read on the
 * server yet and every report starts empty. When a service is stored in the database, read it here
 * (server side) and its report fills in with nothing else changed.
 */
export async function loadReportSources(): Promise<ReportSources> {
  return { ...emptySources(), ...(await loadDashboardSources()) };
}
