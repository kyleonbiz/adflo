import { test as base, expect } from "@playwright/test";
import { todayLocal } from "../../src/lib/dates";
import { sampleRequests, sampleRoutines } from "../support/admin-sample-data";
import { sampleContacts } from "../support/contacts-sample-data";
import { sampleSubmissions } from "../support/forms-sample-data";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";
import { sampleVendors } from "../support/vendors-sample-data";

/**
 * The app starts empty, so every browser test begins with these records in each service (see
 * `src/lib/e2e-seed.ts`). Documents are not seeded: tests upload what they need (see `docs.ts`).
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const today = todayLocal();
    const seed = {
      invoices: sampleInvoices(today), licenses: sampleLicenses(today), projects: sampleProjects(today),
      vendors: sampleVendors(today), contacts: sampleContacts(today), requests: sampleRequests(today),
      routines: sampleRoutines(today), submissions: sampleSubmissions(today),
    };
    await page.addInitScript((s) => { (window as unknown as { __E2E_SEED__: unknown }).__E2E_SEED__ = s; }, seed);
    await provide(page);
  },
});

export { expect };
