import type { DashboardSources } from "./logic";

/**
 * The one place the dashboard gets its records. The services keep their records in the browser until
 * they are backed by the database, so there is nothing to read on the server yet and the dashboard
 * starts empty. When the services are stored in the database, read them here (server side) and
 * nothing else on the dashboard changes.
 */
export async function loadDashboardSources(): Promise<DashboardSources> {
  return { invoices: [], licenses: [], projects: [], vendors: [], requests: [], routines: [] };
}
