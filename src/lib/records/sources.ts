import { useMemo } from "react";
import type { DashboardSources } from "@/lib/dashboard/logic";
import { e2eSeed } from "@/lib/e2e-seed";
import type { Contact } from "@/lib/contacts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { License } from "@/lib/licenses/types";
import type { Project } from "@/lib/projects/types";
import type { Vendor } from "@/lib/vendors/types";
import { industryLicenses } from "@/lib/setup/industries";
import { useSetupConfig } from "@/lib/setup/storage";
import type { SetupConfig } from "@/lib/setup/types";
import { installedLicenses } from "@/lib/setup/templates";
import { useRecordsLoading, useStoredRecords } from "./storage";

/**
 * The licenses to show: your own saved records, or until you save any, the starter records that guided
 * setup installed (only once setup is finished) and the industry's. One rule for the Licenses page,
 * the Dashboard, the bell and Reporting, so they always agree.
 */
export function licenseRecords(edited: License[] | null, today: string | null, setup: SetupConfig | null): License[] {
  if (edited) return edited;
  if (!today) return [];
  const starters = installedLicenses(setup?.completedOn ? setup.templates : [], today);
  // The industry's records skip any a starter template already brought in under the same name.
  const industry = industryLicenses(setup, today).filter((l) => !starters.some((s) => s.name.toLowerCase() === l.name.toLowerCase()));
  return [...(e2eSeed<License>("licenses") ?? []), ...starters, ...industry];
}

/**
 * Every service's records as the browser holds them; this is what the Dashboard, the bell and Reporting read.
 * Until the browser's day is known (the server render and the hydration pass) it is empty, so the
 * first client render matches the server's.
 */
export function useDashboardSources(today: string | null): DashboardSources & { contacts: Contact[] } {
  const invoices = useStoredRecords<Invoice>("invoices");
  const licenses = useStoredRecords<License>("licenses");
  const projects = useStoredRecords<Project>("projects");
  const vendors = useStoredRecords<Vendor>("vendors");
  const contacts = useStoredRecords<Contact>("contacts");
  const setup = useSetupConfig();
  const loading = useRecordsLoading();
  return useMemo(() => !today || loading ? { invoices: [], licenses: [], projects: [], vendors: [], contacts: [] } : ({
    invoices: invoices ?? e2eSeed<Invoice>("invoices") ?? [],
    licenses: licenseRecords(licenses, today, setup),
    projects: projects ?? e2eSeed<Project>("projects") ?? [],
    vendors: vendors ?? e2eSeed<Vendor>("vendors") ?? [],
    contacts: contacts ?? e2eSeed<Contact>("contacts") ?? [],
  }), [invoices, licenses, projects, vendors, contacts, setup, today, loading]);
}
