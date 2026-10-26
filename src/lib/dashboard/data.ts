import { sampleRequests, sampleRoutines } from "@/lib/admin/sample-data";
import { sampleInvoices } from "@/lib/invoices/sample-data";
import { sampleLicenses } from "@/lib/licenses/sample-data";
import { sampleProjects } from "@/lib/projects/sample-data";
import { sampleVendors } from "@/lib/vendors/sample-data";
import type { DashboardSources } from "./logic";

/**
 * The one place the dashboard gets its records. It serves sample data for now; when the services are
 * backed by the database, read them here (server side) and nothing else on the dashboard changes.
 */
export async function loadDashboardSources(today: string): Promise<DashboardSources> {
  return {
    invoices: sampleInvoices(today),
    licenses: sampleLicenses(today),
    projects: sampleProjects(today),
    vendors: sampleVendors(today),
    requests: sampleRequests(today),
    routines: sampleRoutines(today),
  };
}
